<?php

namespace App\Http\Controllers\Learn;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Lesson;
use App\Models\LessonCheck;
use App\Models\LessonNote;
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

/** Página da aula: conteúdo, progresso do vídeo, perguntas rápidas, quiz e notas. A aula conclui-se sozinha (ver LearningService). */
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
        // Rascunho: sai do catálogo, mas quem já está inscrito continua a estudar (e a gestão pré-visualiza)
        abort_unless($course->status === 'published' || in_array($access['mode'], ['preview', 'enrolled', 'expired'], true), 404);

        $lessons = $this->learning->lessons($course);
        $done = $access['mode'] === 'enrolled' ? $this->learning->completedIds($user, $lessons) : collect();
        if (! $this->learning->canOpen($access, $course, $lesson)) {
            return to_route('learn.course', $course->slug)->with('status', __('Esta aula só abre para quem está inscrito no curso.'));
        }

        if ($access['mode'] === 'enrolled' && $this->finishOnOpen($user, $lesson)) {
            $done = $this->learning->completedIds($user, $lessons);
            if ($this->newCertificate($user, $course)) {
                $request->session()->now('status', $this->doneMessage($user, $course));
            }
        }

        $p = LessonProgress::where('user_id', $user->id)->where('lesson_id', $lesson->id)->first();
        $i = $lessons->search(fn ($l) => $l->id === $lesson->id);
        $prev = $lessons->get($i - 1);
        $next = $lessons->get($i + 1);
        $duration = $this->learning->videoDuration($lesson, $p);
        // Só links de avatar dos sites aceites (auditoria, ponto 8): outro link não abre dentro da aula
        $avatar = $lessons->first(fn ($l) => $l->content_type === 'avatar' && CourseBuilder::validAvatarUrl($l->avatar_ref));

        return Inertia::render('Learn/Lesson', [
            'course' => [
                'slug' => $course->slug,
                'title' => $course->title,
                'percent' => $lessons->count() ? (int) floor($done->count() / $lessons->count() * 100) : 0,
            ],
            'mode' => $access['mode'] === 'enrolled' ? 'enrolled' : ($access['mode'] === 'preview' ? 'preview' : 'sample'),
            'program' => $this->program($course, $lessons, $done, $access, $lesson->id),
            'lesson' => $this->lessonPayload($lesson, $user, $p),
            'position' => ['index' => $i + 1, 'total' => $lessons->count()],
            'progress' => [
                'status' => $p?->status ?? 'not_started',
                'watched' => (int) ($p?->watched_seconds ?? 0),
                'map' => $p?->watched_map,
                'duration' => $duration,
                'position' => (int) ($p?->last_position_seconds ?? 0),
                'needed' => (int) ceil($duration * LearningService::VIDEO_THRESHOLD),
                // Vídeo sem os minutos do formador: não conclui a aula (o aluno é avisado)
                'noDuration' => $this->learning->isVideo($lesson) && ! $this->learning->hasKnownDuration($lesson),
            ],
            'prev' => $prev ? ['ulid' => $prev->ulid, 'title' => $prev->title] : null,
            'next' => $next ? ['ulid' => $next->ulid, 'title' => $next->title, 'open' => $this->learning->canOpen($access, $course, $next)] : null,
            'avatarUrl' => $avatar?->avatar_ref,
            // Avaliação final do curso (botão Avaliação): o modo e, com perguntas, o questionário
            'finalEvaluation' => $this->finalPayload($course, $user),
            // Botão Avaliação (2026-11-27): o próximo teste com avatar por fazer; depois, a avaliação final com avatar
            'avatarTest' => $this->nextAvatarTest($lessons, $done, $lesson, $i),
            // Todos os testes com avatar do curso (a caixa do teste mostra onde o aluno está)
            'avatarTests' => $lessons->filter(fn ($l) => $l->kindName() === 'teste' && $l->evaluationKind() === 'avatar')->values()->map(fn ($l) => [
                'ulid' => $l->ulid,
                'title' => $l->title,
                'module' => $l->module?->title,
                'minutes' => (int) round($l->duration_seconds / 60) ?: max(1, (int) config('services.tavus.evaluation_minutes', 15)),
                'done' => $done->contains($l->id),
            ]),
            'notes' => LessonNote::where('user_id', $user->id)->where('lesson_id', $lesson->id)
                ->orderBy('position_seconds')->orderBy('id')->get()->map(fn ($n) => $this->notePayload($n))->values(),
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

        return response()->json([
            'watched' => $p->watched_seconds,
            'ready' => $this->learning->videoReady($lesson, $p),
            'completed' => $this->finishVideo($request, $lesson),
        ]);
    }

    public function check(Request $request, Lesson $lesson, LessonCheck $check): JsonResponse
    {
        abort_unless($check->lesson_id === $lesson->id, 404);
        $this->guard($request->user(), $lesson);
        $data = $request->validate(['answer' => ['required', 'integer', 'min:0']]);

        $result = $this->learning->answerCheck($request->user(), $lesson, $check, $data['answer']);

        return response()->json($result + ['completed' => $this->finishVideo($request, $lesson)]);
    }

    /** Nota do aluno; nas aulas de vídeo vem com o segundo em que estava. */
    public function storeNote(Request $request, Lesson $lesson): JsonResponse
    {
        $this->guard($request->user(), $lesson);
        $data = $request->validate([
            'body' => ['required', 'string', 'max:2000'],
            'position' => ['nullable', 'integer', 'min:0'],
        ]);
        $note = LessonNote::create([
            'user_id' => $request->user()->id,
            'lesson_id' => $lesson->id,
            'position_seconds' => $data['position'] ?? null,
            'body' => trim($data['body']),
        ]);

        return response()->json($this->notePayload($note), 201);
    }

    public function destroyNote(Request $request, Lesson $lesson, LessonNote $note): JsonResponse
    {
        abort_unless($note->lesson_id === $lesson->id && $note->user_id === $request->user()->id, 404);
        $note->delete();

        return response()->json(['deleted' => true]);
    }

    public function quiz(Request $request, Lesson $lesson): RedirectResponse
    {
        [$course] = $this->guard($request->user(), $lesson);
        $data = $request->validate(['answers' => ['required', 'array']]);
        $attempt = $this->learning->submitQuiz($request->user(), $lesson, $data['answers']);

        return back()->with('status', $attempt->passed ? $this->doneMessage($request->user(), $course, __('Passaste no teste!')) : __('Tentativa registada. Revê as respostas.'));
    }

    private function finalPayload(Course $course, User $user): array
    {
        $mode = $course->finalMode();
        $quiz = $mode === 'questions' ? $course->finalQuiz()->with('questions.options')->first() : null;
        $payload = $quiz ? $this->quizPayload($quiz, $user) : null;

        return [
            'mode' => $quiz || $mode !== 'questions' ? $mode : 'none',
            'quiz' => $payload,
            'done' => (bool) ($payload['passed'] ?? false),
        ];
    }

    /**
     * O teste com avatar que o botão Avaliação abre: o primeiro por fazer do módulo onde o aluno está; senão o próximo
     * no programa; senão o primeiro que falte. Null quando já fez todos (o botão passa à avaliação final com avatar).
     */
    private function nextAvatarTest(\Illuminate\Support\Collection $lessons, \Illuminate\Support\Collection $done, Lesson $current, int|false $i): ?array
    {
        $pending = $lessons->values()->filter(fn ($l) => $l->kindName() === 'teste' && $l->evaluationKind() === 'avatar' && ! $done->contains($l->id));
        $pick = $pending->first(fn ($l) => $l->module_id === $current->module_id)
            ?? $pending->first(fn ($l, $k) => $i !== false && $k >= $i)
            ?? $pending->first();

        return $pick ? [
            'ulid' => $pick->ulid,
            'title' => $pick->title,
            'minutes' => (int) round($pick->duration_seconds / 60) ?: max(1, (int) config('services.tavus.evaluation_minutes', 15)),
        ] : null;
    }

    /** Exercício prático: o aluno marca-o como feito. */
    public function done(Request $request, Lesson $lesson): JsonResponse
    {
        $this->guard($request->user(), $lesson);
        abort_unless($lesson->kindName() === 'exercicio' && $lesson->evaluationKind() === 'none', 404);
        $this->learning->completeOnOpen($request->user(), $lesson);
        if ($this->newCertificate($request->user(), $lesson->module->course)) {
            $request->session()->flash('status', $this->doneMessage($request->user(), $lesson->module->course));
        }

        return response()->json(['completed' => true]);
    }

    /** Avaliação final do curso com perguntas. */
    public function finalQuiz(Request $request, Course $course): RedirectResponse
    {
        abort_unless($this->learning->access($request->user(), $course)['mode'] === 'enrolled', 403, __('Inscreve-te no curso para guardar o progresso.'));
        abort_unless($course->finalMode() === 'questions', 404);
        $data = $request->validate(['answers' => ['required', 'array']]);
        $attempt = $this->learning->submitFinal($request->user(), $course, $data['answers']);

        return back()->with('status', $attempt->passed ? $this->doneMessage($request->user(), $course, __('Passaste na avaliação final!')) : __('Tentativa registada. Revê as respostas.'));
    }

    /** Só quem está inscrito (dentro da validade) pode registar progresso. */
    private function guard(User $user, Lesson $lesson): array
    {
        $course = $lesson->module->course;
        $access = $this->learning->access($user, $course);
        abort_unless($access['mode'] === 'enrolled', 403, __('Inscreve-te no curso para guardar o progresso.'));

        return [$course];
    }

    /** Conclui ao abrir as aulas sem nada para ver até ao fim; o vídeo só se já cumpre as condições. */
    private function finishOnOpen(User $user, Lesson $lesson): bool
    {
        // Com questionário (teste ou exercício com perguntas), conclui-se ao entregar/passar.
        if ($lesson->evaluationKind() === 'quiz') {
            return false;
        }
        // Teste com avatar, roleplay e exercício prático têm o seu fim (conversa terminada, "Marcar como feito")
        if ($lesson->usesAvatar() || $lesson->kindName() === 'exercicio') {
            return false;
        }
        if ($this->learning->isVideo($lesson) && $this->videoSource($lesson->content_url)) {
            return $this->learning->completeVideoIfReady($user, $lesson);
        }

        return $this->learning->completeOnOpen($user, $lesson);
    }

    /** Depois de guardar progresso ou uma resposta; o aviso aparece quando a página pede os dados novos. */
    private function finishVideo(Request $request, Lesson $lesson): bool
    {
        $completed = $this->learning->completeVideoIfReady($request->user(), $lesson);
        if ($completed) {
            $request->session()->flash('status', $this->doneMessage($request->user(), $lesson->module->course));
        }

        return $completed;
    }

    private function newCertificate(User $user, Course $course): ?\App\Models\Certificate
    {
        // O certificado que saiu neste pedido (antes: "emitido há menos de 10 segundos", que podia falhar ou repetir)
        $issued = $this->learning->lastIssued;

        return $issued && $issued->user_id === $user->id && $issued->course_id === $course->id ? $issued : null;
    }

    private function doneMessage(User $user, Course $course, string $prefix = 'Aula concluída!'): string
    {
        $prefix = __($prefix);
        $cert = $this->newCertificate($user, $course);

        return $cert ? __(':prefix Curso concluído. Certificado :number emitido.', ['prefix' => $prefix, 'number' => $cert->certificate_number]) : $prefix;
    }

    private function notePayload(LessonNote $note): array
    {
        return ['id' => $note->id, 'position' => $note->position_seconds, 'body' => $note->body];
    }

    private function lessonPayload(Lesson $lesson, User $user, ?LessonProgress $p): array
    {
        $answers = $p?->check_answers ?? [];
        $parts = $lesson->partList();
        $evaluation = $lesson->evaluationKind();
        $kind = $lesson->kindName();
        // O avatar de ajuda é do curso (fase 2): está em todas as atividades de um curso com o avatar ligado
        $sent = array_values(array_unique(array_merge(
            array_diff($parts, ['avatar']),
            $lesson->module?->course?->alex_enabled ? ['avatar'] : [],
        )));
        // Teste com avatar ou roleplay: faz-se na caixa do avatar
        $activity = $lesson->usesAvatar() ? ($kind === 'roleplay' ? 'roleplay' : 'teste') : null;

        $payload = [
            'ulid' => $lesson->ulid,
            'title' => $lesson->title,
            'type' => $lesson->content_type,
            'kind' => $kind,
            'graded' => $kind === 'roleplay' ? (bool) $lesson->graded : $kind === 'teste',
            'role' => $kind === 'roleplay' ? $lesson->roleplay_role : null,
            'activity' => $activity,
            // Avatar da atividade por link (em vez do Tavus): abre num separador
            'activityLink' => $activity && CourseBuilder::validAvatarUrl($lesson->avatar_ref) ? $lesson->avatar_ref : null,
            'parts' => $sent,
            'evaluation' => $evaluation,
            'minutes' => (int) round($lesson->duration_seconds / 60),
            // Link de avatar antigo (aulas do tipo avatar de antes do Alex): só dos sites aceites
            'url' => in_array('avatar', $parts, true) && CourseBuilder::validAvatarUrl($lesson->avatar_ref) ? $lesson->avatar_ref : null,
            'video' => in_array('video', $parts, true) ? $this->videoSource($lesson->content_url) : null,
            // O texto da aula (notas), o que o aluno faz no exercício prático ou a situação do roleplay
            'body' => in_array('notas', $parts, true) || in_array($kind, ['exercicio', 'roleplay'], true) ? $lesson->body : null,
            'done' => $p?->status === 'completed',
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

        if ($evaluation === 'quiz' && ($quiz = $lesson->quiz()->with('questions.options')->first())) {
            $payload['quiz'] = $this->quizPayload($quiz, $user);
        }

        return $payload;
    }

    /** Perguntas, tentativas e valor de cada pergunta de um questionário (teste, exercício ou avaliação final). */
    private function quizPayload(\App\Models\Quiz $quiz, User $user): array
    {
        $attempts = QuizAttempt::where('user_id', $user->id)->where('quiz_id', $quiz->id)->orderBy('attempted_at')->orderBy('id')->get();
        $max = $this->learning->maxAttempts($quiz);
        $passed = $attempts->contains('passed', true);
        // As respostas certas só se mostram quando o teste fica fechado (passou ou esgotou as tentativas);
        // no exercício (sem nota), logo depois de entregar
        $reveal = $passed || $attempts->count() >= $max;
        $correct = $quiz->questions->mapWithKeys(fn ($q) => [$q->id => $q->options->firstWhere('is_correct', true)?->id]);
        // Quanto vale cada pergunta (0-100): por igual, ou pelos pesos
        $total = $quiz->weighted ? max(1, $quiz->questions->sum(fn ($q) => max(0, (int) $q->points))) : max(1, $quiz->questions->count());

        return [
            'graded' => (bool) $quiz->graded,
            'passing' => $quiz->passing_score ?: 70,
            'max' => $max,
            'passed' => $passed,
            'questions' => $quiz->questions->map(fn ($q) => [
                'id' => $q->id,
                'question' => $q->question,
                'value' => round(($quiz->weighted ? max(0, (int) $q->points) : 1) / $total * 100, 1),
                // Opções vazias (o editor guarda-as enquanto o formador escreve) não aparecem ao aluno
                'options' => $q->options->filter(fn ($o) => trim($o->option_text) !== '')
                    ->map(fn ($o) => ['id' => $o->id, 'text' => $o->option_text])->values(),
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

    /**
     * Vídeos nossos (HLS .m3u8 ou MP4/WebM) tocam no leitor próprio; YouTube e Vimeo têm leitor com contagem
     * do tempo visto; outros links abrem num separador.
     */
    private function videoSource(?string $url): ?array
    {
        if (CourseBuilder::uploadedVideo($url)) return ['kind' => 'file', 'url' => $url]; // carregado pelo formador
        if (! CourseBuilder::validUrl($url)) return null;
        if (preg_match('~\.(m3u8|mp4|webm)(\?|$)~i', $url)) {
            return ['kind' => 'file', 'url' => $url];
        }
        if (preg_match('~(?:youtube\.com/(?:watch\?v=|embed/|shorts/)|youtu\.be/)([\w-]{11})~', $url, $m)) {
            return ['kind' => 'youtube', 'id' => $m[1]];
        }
        if (preg_match('~vimeo\.com/(?:video/)?(\d+)~', $url, $m)) {
            return ['kind' => 'vimeo', 'id' => $m[1]];
        }

        return ['kind' => 'link', 'url' => $url];
    }
}
