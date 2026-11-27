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
use App\Support\Activity;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Regras da página do curso e da aula do aluno:
 * - acesso: inscrito (dentro da validade), pré-visualização (formador do curso / gestão) ou aula de amostra;
 * - quem está inscrito abre qualquer aula, pela ordem que quiser;
 * - vídeo: conclui sozinho depois de ver 90% (segundos realmente reproduzidos); as perguntas rápidas são opcionais;
 * - documento, texto e avatar: concluem ao abrir;
 * - quiz: até 3 tentativas, conclui ao passar; certificado emitido automaticamente ao cumprir os critérios.
 */
class LearningService
{
    public const VIDEO_THRESHOLD = 0.9;

    public const MAX_VIDEO_SECONDS = 6 * 3600; // tamanho máximo do mapa de segundos vistos

    /** Certificado emitido neste pedido (a página da aula dá os parabéns); null se nenhum saiu. */
    public ?Certificate $lastIssued = null;

    /**
     * Segundos de vídeo novos que o servidor aceita: no máximo o tempo real que passou desde o último envio,
     * à velocidade máxima do leitor (2×), mais uma pequena folga. O leitor envia o mapa inteiro, por isso o que
     * ficar de fora entra no envio seguinte. Assim, marcar a aula como vista sem a ver leva tanto tempo como vê-la a 2×.
     */
    public const MAX_PLAYBACK_RATE = 2;

    public const PING_SLACK_SECONDS = 5;

    public const FIRST_PING_SECONDS = 30;

    /** A duração enviada pelo leitor só conta se for pelo menos metade da indicada pelo formador (arredondada aos minutos). */
    public const MIN_REPORTED_DURATION_RATIO = 0.5;

    /** @return array{mode: string, enrollment: ?Enrollment, expires_at: ?\Illuminate\Support\Carbon} */
    public function access(User $user, Course $course): array
    {
        $enrollment = Enrollment::where('user_id', $user->id)->where('course_id', $course->id)->first();
        $expires = $enrollment?->setRelation('course', $course)->expiresAt(); // a regra da validade está em Enrollment
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

    public function canOpen(array $access, Course $course, Lesson $lesson): bool
    {
        // Só quem está inscrito (e a equipa, em pré-visualização). A aula de amostra grátis saiu a 2026-11-26.
        return in_array($access['mode'], ['preview', 'enrolled'], true);
    }

    public function isVideo(Lesson $lesson): bool
    {
        return $lesson->hasPart('video');
    }

    /** Duração a usar no limite dos 90%: a reportada pelo leitor ou, sem ela, a indicada pelo formador. */
    public function videoDuration(Lesson $lesson, ?LessonProgress $p): int
    {
        return (int) ($p?->video_duration_seconds ?: $lesson->duration_seconds);
    }

    /**
     * O vídeo já conta como visto (90%)? Sem os minutos do formador não há como confirmar quanto falta (a duração
     * enviada pelo browser podia ser 1 segundo), por isso o vídeo não conclui a aula (auditoria, ponto 5).
     */
    public function videoReady(Lesson $lesson, ?LessonProgress $p): bool
    {
        if (! $this->hasKnownDuration($lesson)) {
            return false;
        }

        return $p !== null && $p->watched_seconds >= (int) ceil($this->videoDuration($lesson, $p) * self::VIDEO_THRESHOLD);
    }

    /** O formador indicou os minutos do vídeo (obrigatório para publicar). */
    public function hasKnownDuration(Lesson $lesson): bool
    {
        return (int) $lesson->duration_seconds > 0;
    }

    /**
     * Junta os segundos vistos agora (mapa de bits em base64) aos já guardados.
     * O browser pode mentir, por isso: a duração enviada não pode ser muito menor do que a do formador, e os segundos
     * novos aceites em cada envio não passam do tempo real que passou (ver MAX_PLAYBACK_RATE).
     */
    public function recordProgress(User $user, Lesson $lesson, int $position, ?string $map, ?int $duration): LessonProgress
    {
        return DB::transaction(function () use ($user, $lesson, $position, $map, $duration) {
            $this->lockLearner($user);
            $p = LessonProgress::firstOrNew(['user_id' => $user->id, 'lesson_id' => $lesson->id]);
            if ($p->status !== 'completed') $p->status = 'in_progress';

            if ($map !== null) {
                $old = (string) base64_decode((string) $p->watched_map);
                $sent = substr((string) base64_decode($map, true), 0, intdiv(self::MAX_VIDEO_SECONDS, 8));
                $budget = $p->video_pinged_at
                    ? (int) $p->video_pinged_at->diffInSeconds(now(), true) * self::MAX_PLAYBACK_RATE + self::PING_SLACK_SECONDS
                    : self::FIRST_PING_SECONDS;
                $merged = $this->mergeWithin($old, $sent, $budget);
                $p->watched_map = base64_encode($merged);
                $p->watched_seconds = $this->countBits($merged);
                $p->video_pinged_at = now();
            }
            if ($duration && $duration > 0) {
                $floor = (int) floor(((int) $lesson->duration_seconds) * self::MIN_REPORTED_DURATION_RATIO);
                if ($duration >= $floor) {
                    $p->video_duration_seconds = min($duration, self::MAX_VIDEO_SECONDS);
                }
            }
            $p->last_position_seconds = max(0, $position);
            $total = $this->videoDuration($lesson, $p);
            if ($p->status !== 'completed') {
                $p->progress_percent = $total ? min(99, (int) floor($p->watched_seconds / $total * 100)) : 0;
            }
            $p->save();

            return $p;
        });
    }

    /** Junta ao mapa guardado os segundos novos do mapa enviado, no máximo $budget segundos (os primeiros do vídeo). */
    private function mergeWithin(string $old, string $sent, int $budget): string
    {
        $len = max(strlen($old), strlen($sent));
        $old = str_pad($old, $len, "\0");
        $sent = str_pad($sent, $len, "\0");
        $out = '';
        for ($i = 0; $i < $len; $i++) {
            $o = ord($old[$i]);
            $fresh = ord($sent[$i]) & ~$o;
            for ($b = 0; $fresh && $b < 8; $b++) {
                $bit = 1 << $b;
                if (! ($fresh & $bit)) continue;
                if ($budget <= 0) break;
                $o |= $bit;
                $budget--;
            }
            $out .= chr($o);
        }

        return rtrim($out, "\0");
    }

    /**
     * Bloqueia a linha da pessoa até ao fim da transação: os pedidos da mesma pessoa que mexem no progresso, nas
     * tentativas e no certificado passam um de cada vez (um duplo clique não dá 4 tentativas nem 2 certificados).
     */
    private function lockLearner(User $user): void
    {
        User::withTrashed()->whereKey($user->id)->lockForUpdate()->value('id');
    }

    /** Responde a uma pergunta rápida (uma só vez) e devolve a correção. */
    public function answerCheck(User $user, Lesson $lesson, LessonCheck $check, int $answer): array
    {
        return DB::transaction(function () use ($user, $lesson, $check, $answer) {
            $this->lockLearner($user);
            $p = LessonProgress::firstOrNew(['user_id' => $user->id, 'lesson_id' => $lesson->id]);
            $answers = $p->check_answers ?? [];
            if (! array_key_exists((string) $check->id, $answers)) {
                $answers[(string) $check->id] = max(0, min($answer, count($check->options) - 1));
                $p->check_answers = $answers;
                if (! $p->exists) $p->status = 'in_progress';
                $p->save();
            }

            return ['chosen' => $answers[(string) $check->id], 'correct' => $check->correct, 'explanation' => $check->explanation];
        });
    }

    /** Vídeo: fica concluída quando o aluno viu 90%. Devolve true se concluiu agora. */
    public function completeVideoIfReady(User $user, Lesson $lesson): bool
    {
        // Com questionário, é ele que conclui a aula (ao passar). A avaliação com o avatar não prende a aula: a nota
        // vem da plataforma dos avatares, que ainda não está ligada (2026-11-25)
        if (! $this->isVideo($lesson) || $lesson->evaluationKind() === 'quiz') {
            return false;
        }
        $p = LessonProgress::where('user_id', $user->id)->where('lesson_id', $lesson->id)->first();
        // Sem nada visto não conclui, mesmo que a duração do vídeo ainda não seja conhecida
        if (! $p || $p->status === 'completed' || $p->watched_seconds <= 0 || ! $this->videoReady($lesson, $p)) {
            return false;
        }
        $this->markCompleted($user, $lesson);

        return true;
    }

    /** Aulas sem nada para ver até ao fim (documento, texto, avatar, vídeo sem link válido): ficam concluídas ao abrir. */
    public function completeOnOpen(User $user, Lesson $lesson): bool
    {
        if (LessonProgress::where('user_id', $user->id)->where('lesson_id', $lesson->id)->where('status', 'completed')->exists()) {
            return false;
        }
        $this->markCompleted($user, $lesson);

        return true;
    }

    /**
     * Entrega uma tentativa do quiz. answers = [question_id => option_id].
     * As tentativas contam-se com a pessoa bloqueada: dois envios ao mesmo tempo não passam das 3 tentativas.
     */
    public function submitQuiz(User $user, Lesson $lesson, array $answers): QuizAttempt
    {
        return DB::transaction(function () use ($user, $lesson, $answers) {
            $this->lockLearner($user);

            return $this->recordAttempt($user, $lesson, $answers);
        });
    }

    /** Avaliação final do curso com perguntas (as mesmas regras de um teste, sem aula). */
    public function submitFinal(User $user, Course $course, array $answers): QuizAttempt
    {
        return DB::transaction(function () use ($user, $course, $answers) {
            $this->lockLearner($user);

            return $this->recordAttempt($user, null, $answers, $course->finalQuiz()->with('questions.options')->firstOrFail(), $course);
        });
    }

    private function recordAttempt(User $user, ?Lesson $lesson, array $answers, ?Quiz $quiz = null, ?Course $course = null): QuizAttempt
    {
        $quiz ??= $lesson->quiz()->with('questions.options')->firstOrFail();
        $attempts = QuizAttempt::where('user_id', $user->id)->where('quiz_id', $quiz->id)->get();
        // Exercício (sem nota): pode repetir à vontade
        if ($quiz->graded && $attempts->contains('passed', true)) {
            throw ValidationException::withMessages(['quiz' => __('Já passaste neste teste.')]);
        }
        if ($quiz->graded && $attempts->count() >= $this->maxAttempts($quiz)) {
            throw ValidationException::withMessages(['quiz' => __('Já usaste todas as tentativas.')]);
        }

        $clean = [];
        $right = [];
        foreach ($quiz->questions as $q) {
            $chosen = (int) ($answers[$q->id] ?? 0);
            if (! $q->options->contains('id', $chosen)) {
                throw ValidationException::withMessages(['quiz' => __('Responde a todas as perguntas.')]);
            }
            $clean[$q->id] = $chosen;
            $right[$q->id] = (bool) $q->options->firstWhere('id', $chosen)->is_correct;
        }
        // 0 a 100: os 100% repartidos por igual entre as perguntas, ou pelos pesos (Quiz::scoreOf)
        $score = $quiz->scoreOf($right);
        // Exercício: sem nota, fica feito ao entregar
        $passed = ! $quiz->graded || $score >= ($quiz->passing_score ?: 70);

        $attempt = QuizAttempt::create([
            'user_id' => $user->id, 'quiz_id' => $quiz->id, 'score' => $score, 'passed' => $passed,
            'answers' => $clean, 'attempted_at' => now(),
        ]);
        if (! $lesson) {
            $this->afterProgress($user, $course); // avaliação final: a nota pode dar o certificado
        } elseif ($passed) {
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
            $this->lockLearner($user);
            $p = LessonProgress::firstOrNew(['user_id' => $user->id, 'lesson_id' => $lesson->id]);
            $p->status = 'completed';
            $p->progress_percent = 100;
            $p->completed_at ??= now();
            $p->save();
            $this->afterProgress($user, $lesson->module->course);
        });
    }

    /**
     * Depois de cada aula concluída (ou presença confirmada): fecha a inscrição quando acaba e emite o certificado.
     * A inscrição fica concluída com todas as aulas feitas ou quando sai o certificado (que pode pedir menos de 100%).
     * Corre com a pessoa bloqueada, para dois pedidos ao mesmo tempo não emitirem dois certificados.
     */
    public function afterProgress(User $user, Course $course): ?Certificate
    {
        return DB::transaction(function () use ($user, $course) {
            $this->lockLearner($user);
            $lessons = $this->lessons($course);
            $done = $this->completedIds($user, $lessons);
            if ($lessons->isNotEmpty() && $done->count() >= $lessons->count()) {
                $this->closeEnrollment($user, $course);
            }
            $status = $this->certificateStatus($user, $course, $lessons, $done);
            if (! $course->certificate_enabled || $status['certificate'] || ! ($status['progress_ok'] && $status['score_ok'] && $status['attendance_ok'])) {
                return null;
            }

            $certificate = $this->lastIssued = Certificate::create([
                'user_id' => $user->id,
                'course_id' => $course->id,
                'certificate_number' => $this->newNumber(),
                'status' => 'valid',
                'issued_at' => now(),
            ]);
            $this->closeEnrollment($user, $course);

            return $certificate;
        });
    }

    private function closeEnrollment(User $user, Course $course): void
    {
        $closed = Enrollment::where('user_id', $user->id)->where('course_id', $course->id)->where('status', '!=', 'completed')
            ->update(['status' => 'completed', 'completed_at' => now()]);
        if ($closed) Activity::log('curso.concluido', $course, related: $user);
    }

    /**
     * Nota do curso (0 a 100, ou null sem nada com nota). Média da melhor tentativa de cada teste com nota; com
     * avaliação final por perguntas, entra com o seu peso (final_weight %) e os testes com o resto (2026-11-27).
     * A avaliação final com avatar ainda não tem nota (vem da plataforma dos avatares): até lá contam só os testes.
     */
    public function courseScore(User $user, Course $course, Collection $lessons): ?int
    {
        $testIds = Quiz::whereIn('lesson_id', $lessons->pluck('id'))->where('graded', true)->pluck('id');
        $final = $course->finalMode() === 'questions' ? $course->finalQuiz()->value('id') : null;
        $best = QuizAttempt::where('user_id', $user->id)->whereIn('quiz_id', $testIds->push($final)->filter())
            ->selectRaw('quiz_id, MAX(score) as best')->groupBy('quiz_id')->pluck('best', 'quiz_id');
        $testIds = $testIds->reject(fn ($id) => $id === $final);
        $tests = $testIds->isEmpty() ? null : $testIds->sum(fn ($id) => (int) ($best[$id] ?? 0)) / $testIds->count();
        if (! $final) {
            return $tests === null ? null : (int) round($tests);
        }
        $finalScore = (int) ($best[$final] ?? 0);
        if ($tests === null) {
            return $finalScore;
        }
        $w = max(0, min(100, (int) $course->final_weight));

        return (int) round($tests * (100 - $w) / 100 + $finalScore * $w / 100);
    }

    /** Critérios do certificado e onde o aluno está. A nota é a média da melhor tentativa de cada teste. */
    public function certificateStatus(User $user, Course $course, Collection $lessons, Collection $done): array
    {
        $progress = $lessons->count() ? (int) floor($done->count() / $lessons->count() * 100) : 0;
        $score = $this->courseScore($user, $course, $lessons);
        $cert = Certificate::where('user_id', $user->id)->where('course_id', $course->id)->where('status', 'valid')->first();
        // Presença: só conta quando o formador a exige no curso; confirma-a em "Os meus cursos" › Alunos
        $attended = $course->requires_attendance
            ? Enrollment::where('user_id', $user->id)->where('course_id', $course->id)->whereNotNull('attended_at')->exists()
            : null;

        return [
            'enabled' => (bool) $course->certificate_enabled,
            'min_progress' => $course->certificate_min_progress,
            'min_score' => $course->certificate_min_score,
            'progress' => $progress,
            'score' => $score,
            'progress_ok' => $progress >= $course->certificate_min_progress,
            'score_ok' => $score === null || $score >= $course->certificate_min_score,
            'attendance' => $attended,
            'attendance_ok' => $attended !== false,
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
