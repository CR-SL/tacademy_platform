<?php

namespace App\Services;

use App\Models\Certificate;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Lesson;
use App\Models\LessonCheck;
use App\Models\LessonProgress;
use App\Models\Quiz;
use App\Models\QuizAttempt;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Regras da página do curso e da aula do aluno:
 * - acesso: inscrito (dentro da validade), pré-visualização (formador do curso / gestão) ou aula de amostra;
 * - aulas desbloqueadas de cada vez (unlock_window; 0 = todas), contando os testes como aulas;
 * - vídeo: só conclui depois de ver 90% (segundos realmente reproduzidos) e responder às perguntas rápidas;
 * - quiz: até 3 tentativas, conclui ao passar; certificado emitido automaticamente ao cumprir os critérios.
 */
class LearningService
{
    public const VIDEO_THRESHOLD = 0.9;

    public const MAX_VIDEO_SECONDS = 6 * 3600; // tamanho máximo do mapa de segundos vistos

    /** @return array{mode: string, enrollment: ?Enrollment, expires_at: ?\Illuminate\Support\Carbon} */
    public function access(User $user, Course $course): array
    {
        $enrollment = Enrollment::where('user_id', $user->id)->where('course_id', $course->id)->first();
        $expires = $enrollment && $course->access_months ? $enrollment->enrolled_at?->copy()->addMonths($course->access_months) : null;
        $canPreview = Gate::forUser($user)->allows('update', $course) || $user->isCourseStaff();

        $mode = match (true) {
            $enrollment && (! $expires || $expires->isFuture()) => 'enrolled',
            $canPreview => 'preview',
            (bool) $enrollment => 'expired',
            default => 'none',
        };

        return ['mode' => $mode, 'enrollment' => $enrollment, 'expires_at' => $expires];
    }

    /** Aulas do curso pela ordem do programa (módulo, depois aula), com o módulo carregado. */
    public function lessons(Course $course): Collection
    {
        $course->loadMissing(['modules' => fn ($q) => $q->orderBy('order_index'), 'modules.lessons' => fn ($q) => $q->orderBy('order_index')]);

        return $course->modules->flatMap(fn ($m) => $m->lessons->each(fn ($l) => $l->setRelation('module', $m)))->values();
    }

    public function completedIds(User $user, Collection $lessons): Collection
    {
        return LessonProgress::where('user_id', $user->id)->whereIn('lesson_id', $lessons->pluck('id'))
            ->where('status', 'completed')->pluck('lesson_id');
    }

    /** Concluídas + as N seguintes por fazer (N = unlock_window; 0 = todas). */
    public function unlockedIds(Course $course, Collection $lessons, Collection $done): Collection
    {
        if (! $course->unlock_window) {
            return $lessons->pluck('id');
        }
        $next = $lessons->reject(fn ($l) => $done->contains($l->id))->take($course->unlock_window)->pluck('id');

        return $done->merge($next)->unique()->values();
    }

    public function canOpen(array $access, Course $course, Lesson $lesson, Collection $unlocked): bool
    {
        return $access['mode'] === 'preview'
            || ($access['mode'] === 'enrolled' && $unlocked->contains($lesson->id))
            || $lesson->id === $course->sample_lesson_id;
    }

    public function isVideo(Lesson $lesson): bool
    {
        return in_array($lesson->content_type, ['video_link', 'video_upload'], true);
    }

    /** Duração a usar no limite dos 90%: a reportada pelo leitor ou, sem ela, a indicada pelo formador. */
    public function videoDuration(Lesson $lesson, ?LessonProgress $p): int
    {
        return (int) ($p?->video_duration_seconds ?: $lesson->duration_seconds);
    }

    public function videoReady(Lesson $lesson, ?LessonProgress $p): bool
    {
        $duration = $this->videoDuration($lesson, $p);

        return $duration <= 0 || ($p && $p->watched_seconds >= (int) ceil($duration * self::VIDEO_THRESHOLD));
    }

    /** Junta os segundos vistos agora (mapa de bits em base64) aos já guardados. */
    public function recordProgress(User $user, Lesson $lesson, int $position, ?string $map, ?int $duration): LessonProgress
    {
        $p = LessonProgress::firstOrNew(['user_id' => $user->id, 'lesson_id' => $lesson->id]);
        if ($p->status !== 'completed') $p->status = 'in_progress';

        if ($map !== null) {
            $new = substr((string) base64_decode($map, true), 0, intdiv(self::MAX_VIDEO_SECONDS, 8));
            $merged = (string) base64_decode((string) $p->watched_map) | $new;
            $p->watched_map = base64_encode($merged);
            $p->watched_seconds = $this->countBits($merged);
        }
        if ($duration && $duration > 0) {
            $p->video_duration_seconds = min($duration, self::MAX_VIDEO_SECONDS);
        }
        $p->last_position_seconds = max(0, $position);
        $total = $this->videoDuration($lesson, $p);
        if ($p->status !== 'completed') {
            $p->progress_percent = $total ? min(99, (int) floor($p->watched_seconds / $total * 100)) : 0;
        }
        $p->save();

        return $p;
    }

    /** Responde a uma pergunta rápida (uma só vez) e devolve a correção. */
    public function answerCheck(User $user, Lesson $lesson, LessonCheck $check, int $answer): array
    {
        $p = LessonProgress::firstOrNew(['user_id' => $user->id, 'lesson_id' => $lesson->id]);
        $answers = $p->check_answers ?? [];
        if (! array_key_exists((string) $check->id, $answers)) {
            $answers[(string) $check->id] = max(0, min($answer, count($check->options) - 1));
            $p->check_answers = $answers;
            if (! $p->exists) $p->status = 'in_progress';
            $p->save();
        }

        return ['chosen' => $answers[(string) $check->id], 'correct' => $check->correct, 'explanation' => $check->explanation];
    }

    /** "Marcar como concluída" (vídeo, avatar, documento, texto). O quiz conclui-se ao passar. */
    public function complete(User $user, Lesson $lesson): void
    {
        if ($lesson->content_type === 'quiz') {
            throw ValidationException::withMessages(['lesson' => 'Este teste fica concluído quando passares.']);
        }
        $p = LessonProgress::where('user_id', $user->id)->where('lesson_id', $lesson->id)->first();
        if ($this->isVideo($lesson)) {
            if (! $this->videoReady($lesson, $p)) {
                throw ValidationException::withMessages(['lesson' => 'Ainda não viste o vídeo até ao fim.']);
            }
            $missing = $lesson->checks()->pluck('id')->diff(array_map('intval', array_keys($p?->check_answers ?? [])));
            if ($missing->isNotEmpty()) {
                throw ValidationException::withMessages(['lesson' => 'Responde às perguntas rápidas para concluir a aula.']);
            }
        }
        $this->markCompleted($user, $lesson);
    }

    /** Entrega uma tentativa do quiz. answers = [question_id => option_id]. */
    public function submitQuiz(User $user, Lesson $lesson, array $answers): QuizAttempt
    {
        $quiz = $lesson->quiz()->with('questions.options')->firstOrFail();
        $attempts = QuizAttempt::where('user_id', $user->id)->where('quiz_id', $quiz->id)->get();
        if ($attempts->contains('passed', true)) {
            throw ValidationException::withMessages(['quiz' => 'Já passaste neste teste.']);
        }
        if ($attempts->count() >= $this->maxAttempts($quiz)) {
            throw ValidationException::withMessages(['quiz' => 'Já usaste todas as tentativas.']);
        }

        $clean = [];
        $right = 0;
        foreach ($quiz->questions as $q) {
            $chosen = (int) ($answers[$q->id] ?? 0);
            if (! $q->options->contains('id', $chosen)) {
                throw ValidationException::withMessages(['quiz' => 'Responde a todas as perguntas.']);
            }
            $clean[$q->id] = $chosen;
            if ($q->options->firstWhere('id', $chosen)->is_correct) $right++;
        }
        $score = $quiz->questions->count() ? (int) round($right / $quiz->questions->count() * 100) : 0;
        $passed = $score >= ($quiz->passing_score ?: 70);

        $attempt = QuizAttempt::create([
            'user_id' => $user->id, 'quiz_id' => $quiz->id, 'score' => $score, 'passed' => $passed,
            'answers' => $clean, 'attempted_at' => now(),
        ]);
        if ($passed) {
            $this->markCompleted($user, $lesson);
        } else {
            LessonProgress::firstOrCreate(['user_id' => $user->id, 'lesson_id' => $lesson->id], ['status' => 'in_progress']);
        }

        return $attempt;
    }

    public function maxAttempts(Quiz $quiz): int
    {
        return $quiz->max_attempts ?: 3;
    }

    private function markCompleted(User $user, Lesson $lesson): void
    {
        DB::transaction(function () use ($user, $lesson) {
            $p = LessonProgress::firstOrNew(['user_id' => $user->id, 'lesson_id' => $lesson->id]);
            $p->status = 'completed';
            $p->progress_percent = 100;
            $p->completed_at ??= now();
            $p->save();
            $this->afterProgress($user, $lesson->module->course);
        });
    }

    /** Depois de cada aula concluída: fecha a inscrição quando acaba e emite o certificado. */
    public function afterProgress(User $user, Course $course): ?Certificate
    {
        $lessons = $this->lessons($course);
        $done = $this->completedIds($user, $lessons);
        if ($lessons->isNotEmpty() && $done->count() >= $lessons->count()) {
            Enrollment::where('user_id', $user->id)->where('course_id', $course->id)->where('status', '!=', 'completed')
                ->update(['status' => 'completed', 'completed_at' => now()]);
        }
        $status = $this->certificateStatus($user, $course, $lessons, $done);
        if (! $course->certificate_enabled || $status['certificate'] || ! ($status['progress_ok'] && $status['score_ok'])) {
            return null;
        }

        return Certificate::create([
            'user_id' => $user->id,
            'course_id' => $course->id,
            'certificate_number' => $this->newNumber(),
            'status' => 'valid',
            'issued_at' => now(),
        ]);
    }

    /** Critérios do certificado e onde o aluno está. A nota é a média da melhor tentativa de cada teste. */
    public function certificateStatus(User $user, Course $course, Collection $lessons, Collection $done): array
    {
        $progress = $lessons->count() ? (int) floor($done->count() / $lessons->count() * 100) : 0;
        $quizIds = Quiz::whereIn('lesson_id', $lessons->pluck('id'))->pluck('id');
        $best = QuizAttempt::where('user_id', $user->id)->whereIn('quiz_id', $quizIds)
            ->selectRaw('quiz_id, MAX(score) as best')->groupBy('quiz_id')->pluck('best', 'quiz_id');
        $score = $quizIds->isEmpty() ? null : (int) round($quizIds->sum(fn ($id) => (int) ($best[$id] ?? 0)) / $quizIds->count());
        $cert = Certificate::where('user_id', $user->id)->where('course_id', $course->id)->where('status', 'valid')->first();

        return [
            'enabled' => (bool) $course->certificate_enabled,
            'min_progress' => $course->certificate_min_progress,
            'min_score' => $course->certificate_min_score,
            'progress' => $progress,
            'score' => $score,
            'progress_ok' => $progress >= $course->certificate_min_progress,
            'score_ok' => $score === null || $score >= $course->certificate_min_score,
            'certificate' => $cert ? ['number' => $cert->certificate_number, 'issued_at' => $cert->issued_at?->format('d/m/Y')] : null,
        ];
    }

    private function newNumber(): string
    {
        do {
            $n = 'TA-'.now()->format('Y').'-'.strtoupper(Str::random(6));
        } while (Certificate::where('certificate_number', $n)->exists());

        return $n;
    }

    private function countBits(string $bytes): int
    {
        static $table = null;
        $table ??= array_map(fn ($i) => substr_count(decbin($i), '1'), range(0, 255));
        $n = 0;
        foreach (unpack('C*', $bytes) ?: [] as $b) $n += $table[$b];

        return $n;
    }
}
