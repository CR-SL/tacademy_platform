<?php

namespace App\Http\Controllers\Learn;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Lesson;
use App\Models\LessonCheck;
use App\Models\LessonProgress;
use App\Models\QuizAttempt;
use App\Models\User;
use App\Services\CourseBuilder;
use App\Services\LearningService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Página da aula: conteúdo, progresso do vídeo, perguntas rápidas, quiz e "Marcar como concluída". */
class LessonController extends Controller
{
    use BuildsProgram;

    public function __construct(private LearningService $learning) {}

    public function show(Request $request, Course $course, Lesson $lesson): Response|RedirectResponse
    {
        $lesson->loadMissing('module');
        abort_unless($lesson->module?->course_id === $course->id, 404);
        $user = $request->user();
        $access = $this->learning->access($user, $course);
        abort_unless($course->status === 'published' || $access['mode'] === 'preview', 404);

        $lessons = $this->learning->lessons($course);
        $done = $access['mode'] === 'enrolled' ? $this->learning->completedIds($user, $lessons) : collect();
        $unlocked = $this->learning->unlockedIds($course, $lessons, $done);
        if (! $this->learning->canOpen($access, $course, $lesson, $unlocked)) {
            return to_route('learn.course', $course->slug)->with('status', 'Essa aula ainda está bloqueada — conclui as anteriores para a abrir.');
        }

        $p = LessonProgress::where('user_id', $user->id)->where('lesson_id', $lesson->id)->first();
        $i = $lessons->search(fn ($l) => $l->id === $lesson->id);
        $prev = $lessons->get($i - 1);
        $next = $lessons->get($i + 1);
        $duration = $this->learning->videoDuration($lesson, $p);
        $avatar = $lessons->first(fn ($l) => $l->content_type === 'avatar' && CourseBuilder::validUrl($l->avatar_ref));

        return Inertia::render('Learn/Lesson', [
            'course' => [
                'slug' => $course->slug,
                'title' => $course->title,
                'unlock_window' => $course->unlock_window,
                'percent' => $lessons->count() ? (int) floor($done->count() / $lessons->count() * 100) : 0,
            ],
            'mode' => $access['mode'] === 'enrolled' ? 'enrolled' : ($access['mode'] === 'preview' ? 'preview' : 'sample'),
            'program' => $this->program($course, $lessons, $done, $unlocked, $access, $lesson->id),
            'lesson' => $this->lessonPayload($lesson, $user, $p),
            'position' => ['index' => $i + 1, 'total' => $lessons->count()],
            'progress' => [
                'status' => $p?->status ?? 'not_started',
                'watched' => (int) ($p?->watched_seconds ?? 0),
                'map' => $p?->watched_map,
                'duration' => $duration,
                'position' => (int) ($p?->last_position_seconds ?? 0),
                'needed' => (int) ceil($duration * LearningService::VIDEO_THRESHOLD),
            ],
            'prev' => $prev ? ['ulid' => $prev->ulid, 'title' => $prev->title] : null,
            'next' => $next ? ['ulid' => $next->ulid, 'title' => $next->title, 'open' => $this->learning->canOpen($access, $course, $next, $unlocked)] : null,
            'avatarUrl' => $avatar?->avatar_ref,
        ]);
    }

    /** Segundos vistos e posição do vídeo (enviado pelo leitor de x em x segundos). */
    public function progress(Request $request, Lesson $lesson): JsonResponse
    {
        $this->guard($request->user(), $lesson);
        $data = $request->validate([
            'position' => ['required', 'integer', 'min:0'],
            'map' => ['nullable', 'string', 'max:4000'], // até 6 h de vídeo (1 bit por segundo, em base64)
            'duration' => ['nullable', 'integer', 'min:0'],
        ]);
        $p = $this->learning->recordProgress($request->user(), $lesson, $data['position'], $data['map'] ?? null, $data['duration'] ?? null);

        return response()->json(['watched' => $p->watched_seconds, 'ready' => $this->learning->videoReady($lesson, $p)]);
    }

    public function check(Request $request, Lesson $lesson, LessonCheck $check): JsonResponse
    {
        abort_unless($check->lesson_id === $lesson->id, 404);
        $this->guard($request->user(), $lesson);
        $data = $request->validate(['answer' => ['required', 'integer', 'min:0']]);

        return response()->json($this->learning->answerCheck($request->user(), $lesson, $check, $data['answer']));
    }

    public function complete(Request $request, Lesson $lesson): RedirectResponse
    {
        [$course] = $this->guard($request->user(), $lesson);
        $this->learning->complete($request->user(), $lesson);

        return back()->with('status', $this->doneMessage($request->user(), $course));
    }

    public function quiz(Request $request, Lesson $lesson): RedirectResponse
    {
        [$course] = $this->guard($request->user(), $lesson);
        $data = $request->validate(['answers' => ['required', 'array']]);
        $attempt = $this->learning->submitQuiz($request->user(), $lesson, $data['answers']);

        return back()->with('status', $attempt->passed ? $this->doneMessage($request->user(), $course, 'Passaste no teste!') : 'Tentativa registada — revê as respostas.');
    }

    /** Só quem está inscrito (dentro da validade) e tem a aula desbloqueada pode registar progresso. */
    private function guard(User $user, Lesson $lesson): array
    {
        $course = $lesson->module->course;
        $access = $this->learning->access($user, $course);
        abort_unless($access['mode'] === 'enrolled', 403, 'Inscreve-te no curso para guardar o progresso.');
        $lessons = $this->learning->lessons($course);
        $unlocked = $this->learning->unlockedIds($course, $lessons, $this->learning->completedIds($user, $lessons));
        abort_unless($this->learning->canOpen($access, $course, $lesson, $unlocked), 403, 'Esta aula ainda está bloqueada.');

        return [$course];
    }

    private function doneMessage(User $user, Course $course, string $prefix = 'Aula concluída!'): string
    {
        $cert = \App\Models\Certificate::where('user_id', $user->id)->where('course_id', $course->id)
            ->where('issued_at', '>=', now()->subSeconds(10))->first();

        return $cert ? "{$prefix} Curso concluído — certificado {$cert->certificate_number} emitido 🎉" : $prefix;
    }

    private function lessonPayload(Lesson $lesson, User $user, ?LessonProgress $p): array
    {
        $url = $lesson->content_type === 'avatar' ? $lesson->avatar_ref : $lesson->content_url;
        $answers = $p?->check_answers ?? [];

        $payload = [
            'ulid' => $lesson->ulid,
            'title' => $lesson->title,
            'type' => $lesson->content_type,
            'minutes' => (int) round($lesson->duration_seconds / 60),
            'url' => CourseBuilder::validUrl($url) ? $url : null,
            'video' => $this->videoSource($lesson->content_url),
            'body' => $lesson->content_type === 'text' ? $lesson->body : null,
            'attachments' => $lesson->attachments()->get()->map(fn ($a) => ['name' => $a->name, 'url' => $a->url(), 'size' => $a->size])->values(),
            'checks' => $lesson->checks()->get()->map(function (LessonCheck $c) use ($answers) {
                $answered = array_key_exists((string) $c->id, $answers);

                return [
                    'id' => $c->id,
                    'question' => $c->question,
                    'options' => $c->options,
                    'chosen' => $answered ? $answers[(string) $c->id] : null,
                    'correct' => $answered ? $c->correct : null, // a correção só depois de responder
                    'explanation' => $answered ? $c->explanation : null,
                ];
            })->values(),
            'quiz' => null,
        ];

        if ($lesson->content_type === 'quiz' && ($quiz = $lesson->quiz()->with('questions.options')->first())) {
            $attempts = QuizAttempt::where('user_id', $user->id)->where('quiz_id', $quiz->id)->orderBy('attempted_at')->orderBy('id')->get();
            $max = $this->learning->maxAttempts($quiz);
            $passed = $attempts->contains('passed', true);
            // As respostas certas só se mostram quando o teste fica fechado (passou ou esgotou as tentativas)
            $reveal = $passed || $attempts->count() >= $max;
            $correct = $quiz->questions->mapWithKeys(fn ($q) => [$q->id => $q->options->firstWhere('is_correct', true)?->id]);

            $payload['quiz'] = [
                'passing' => $quiz->passing_score ?: 70,
                'max' => $max,
                'passed' => $passed,
                'questions' => $quiz->questions->map(fn ($q) => [
                    'id' => $q->id,
                    'question' => $q->question,
                    'options' => $q->options->map(fn ($o) => ['id' => $o->id, 'text' => $o->option_text])->values(),
                    'correct' => $reveal ? $correct[$q->id] : null,
                ])->values(),
                'attempts' => $attempts->map(fn ($a) => [
                    'score' => $a->score,
                    'passed' => $a->passed,
                    'date' => $a->attempted_at?->format('d/m/Y H:i'),
                    'answers' => $a->answers ?? [],
                    'results' => collect($a->answers ?? [])->map(fn ($opt, $qid) => (int) $opt === (int) ($correct[$qid] ?? 0))->all(),
                ])->values(),
            ];
        }

        return $payload;
    }

    /** YouTube e Vimeo têm leitor com contagem do tempo visto; outros links abrem num separador. */
    private function videoSource(?string $url): ?array
    {
        if (! CourseBuilder::validUrl($url)) return null;
        if (preg_match('~(?:youtube\.com/(?:watch\?v=|embed/|shorts/)|youtu\.be/)([\w-]{11})~', $url, $m)) {
            return ['kind' => 'youtube', 'id' => $m[1]];
        }
        if (preg_match('~vimeo\.com/(?:video/)?(\d+)~', $url, $m)) {
            return ['kind' => 'vimeo', 'id' => $m[1]];
        }

        return ['kind' => 'link', 'url' => $url];
    }
}
