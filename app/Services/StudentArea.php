<?php

namespace App\Services;

use App\Models\Course;
use App\Models\CourseMessage;
use App\Models\Enrollment;
use App\Models\Lesson;
use App\Models\LessonAttachment;
use App\Models\LessonNote;
use App\Models\LessonProgress;
use App\Models\Quiz;
use App\Models\QuizAttempt;
use App\Models\User;
use Illuminate\Support\Collection;

/** Dados dos painéis do aluno: tudo vem da base de dados, nada é inventado. */
class StudentArea
{
    public function __construct(private LearningService $learning) {}

    /** Inscrições com o curso e o programa carregados; cursos apagados ficam de fora. */
    private function enrollments(User $user): Collection
    {
        return Enrollment::with([
            'course',
            'course.category',
            'course.modules' => fn ($q) => $q->orderBy('order_index'),
            'course.modules.lessons' => fn ($q) => $q->orderBy('order_index'),
        ])
            ->where('user_id', $user->id)
            ->orderByDesc('enrolled_at')
            ->get()
            ->filter(fn ($e) => $e->course)
            ->values();
    }

    private function courseLessons(Course $course): Collection
    {
        return $course->modules->flatMap(fn ($m) => $m->lessons);
    }

    private function doneIds(User $user): Collection
    {
        return LessonProgress::where('user_id', $user->id)->where('status', 'completed')->pluck('lesson_id')->flip();
    }

    private function image(Course $course): string
    {
        return $course->thumbnail_url ?: (config('tacademy.course_images')[$course->slug] ?? config('tacademy.course_image_fallback'));
    }

    private function lessonUrl(Course $course, Lesson $lesson): string
    {
        return '/plataforma/cursos/'.$course->slug.'/aulas/'.$lesson->ulid;
    }

    private function expiry(Enrollment $e): ?\Illuminate\Support\Carbon
    {
        return $e->course->access_months ? $e->enrolled_at?->copy()->addMonths($e->course->access_months) : null;
    }

    private function isExpired(Enrollment $e): bool
    {
        return (bool) $this->expiry($e)?->isPast();
    }

    /** Os cursos do aluno, com o progresso real (aulas concluídas sobre o total). */
    public function courses(User $user): array
    {
        $done = $this->doneIds($user);

        return $this->enrollments($user)->map(function (Enrollment $e) use ($done) {
            $lessons = $this->courseLessons($e->course);
            $finished = $lessons->filter(fn ($l) => $done->has($l->id))->count();
            $pct = $lessons->count() ? (int) floor($finished / $lessons->count() * 100) : 0;
            $expiry = $this->expiry($e);

            return [
                'id' => $e->course->id,
                'slug' => $e->course->slug,
                'title' => $e->course->title,
                'image' => $this->image($e->course),
                'area' => $e->course->category?->name,
                'level' => $e->course->level,
                'url' => '/plataforma/cursos/'.$e->course->slug,
                'company' => $e->company_id !== null,
                'pct' => $pct,
                'done' => $finished,
                'total' => $lessons->count(),
                'state' => $lessons->isNotEmpty() && $finished === $lessons->count() ? 'feito' : ($finished === 0 ? 'novo' : 'curso'),
                'expired' => $expiry?->isPast() ?? false,
                'expires' => $expiry?->format('d/m/Y'),
                'completed' => $e->completed_at?->translatedFormat('j M Y'),
                'assigned' => $e->assigned_at?->format('d/m/Y'),
                'deadline' => $expiry?->isPast() ? null : $e->deadlineInfo($lessons->isNotEmpty() && $finished === $lessons->count()),
            ];
        })->all();
    }

    /** Dias antes do fim do prazo a partir dos quais o curso aparece nos Pendentes. */
    public const DEADLINE_SOON_DAYS = 14;

    /** Cursos com o prazo a acabar (ou já passado), para os Pendentes. */
    public function deadlines(User $user): array
    {
        return collect($this->courses($user))
            ->filter(fn ($c) => $c['deadline'] && $c['deadline']['days'] <= self::DEADLINE_SOON_DAYS)
            ->sortBy(fn ($c) => $c['deadline']['days'])
            ->map(fn ($c) => [
                'kind' => 'Prazo',
                'title' => $c['title'],
                'course' => $c['deadline']['late'] ? __('terminou a :date', ['date' => $c['deadline']['date']]) : __('até :date', ['date' => $c['deadline']['date']]),
                'text' => ($c['deadline']['late']
                    ? __('O prazo para concluir este curso já passou.')
                    : ($c['deadline']['days'] === 0 ? __('O prazo termina hoje.') : trans_choice('{1} Falta 1 dia para concluir o curso.|[2,*] Faltam :count dias para concluir o curso.', $c['deadline']['days'])))
                    .' '.__('Já fizeste :done de :total aulas.', ['done' => $c['done'], 'total' => $c['total']])
                    .($c['deadline']['by'] === 'empresa' ? ' '.__('Prazo definido pela tua empresa.') : ''),
                'cta' => $c['done'] ? __('Continuar o curso') : __('Começar o curso'),
                'url' => $c['url'],
            ])->values()->all();
    }

    /**
     * Aula a retomar: a última em que o aluno mexeu e não concluiu; senão, a primeira
     * por concluir do curso mais recente. Só em cursos com acesso válido.
     */
    public function resume(User $user): ?array
    {
        $done = $this->doneIds($user);
        $open = $this->enrollments($user)
            ->reject(fn ($e) => $this->isExpired($e))
            ->filter(fn ($e) => $this->courseLessons($e->course)->contains(fn ($l) => ! $done->has($l->id)))
            ->values();
        if ($open->isEmpty()) {
            return null;
        }

        $lessonIds = $open->flatMap(fn ($e) => $this->courseLessons($e->course)->pluck('id'));
        $last = LessonProgress::where('user_id', $user->id)->whereIn('lesson_id', $lessonIds)
            ->where('status', '!=', 'completed')->latest('updated_at')->first();

        $enrollment = $last
            ? $open->first(fn ($e) => $this->courseLessons($e->course)->contains('id', $last->lesson_id))
            : $open->first();
        $course = $enrollment->course;
        $lessons = $this->courseLessons($course);
        $lesson = $last
            ? $lessons->firstWhere('id', $last->lesson_id)
            : $lessons->first(fn ($l) => ! $done->has($l->id));
        $module = $course->modules->first(fn ($m) => $m->lessons->contains('id', $lesson->id));
        $left = $module->lessons->filter(fn ($l) => ! $done->has($l->id))->count();
        $finished = $lessons->filter(fn ($l) => $done->has($l->id))->count();

        return [
            'course' => $course->title,
            'courseUrl' => '/plataforma/cursos/'.$course->slug,
            'image' => $this->image($course),
            'lesson' => $lesson->title,
            'url' => $this->lessonUrl($course, $lesson),
            'stamp' => $this->stamp($lesson, $last),
            'left' => $left,
            'module' => $module->title,
            'pct' => (int) floor($finished / max($lessons->count(), 1) * 100),
            'modules' => $course->modules->map(fn ($m) => [
                'id' => $m->id,
                'title' => $m->title,
                'done' => $m->lessons->filter(fn ($l) => $done->has($l->id))->count(),
                'total' => $m->lessons->count(),
                'current' => $m->id === $module->id,
                'lessons' => $m->lessons->map(fn ($l) => [
                    'title' => $l->title,
                    'url' => $this->lessonUrl($course, $l),
                    'done' => $done->has($l->id),
                    'current' => $l->id === $lesson->id,
                ])->values(),
            ])->values(),
        ];
    }

    private function stamp(Lesson $lesson, ?LessonProgress $p): ?string
    {
        if (! $p || ! $this->learning->isVideo($lesson) || $p->last_position_seconds <= 0) {
            return null;
        }
        $duration = $this->learning->videoDuration($lesson, $p);

        return $duration
            ? __('Paraste aos :at de :of', ['at' => $this->clock($p->last_position_seconds), 'of' => $this->clock($duration)])
            : __('Paraste aos :at', ['at' => $this->clock($p->last_position_seconds)]);
    }

    private function clock(int $seconds): string
    {
        return intdiv($seconds, 60).':'.str_pad((string) ($seconds % 60), 2, '0', STR_PAD_LEFT);
    }

    /** Link do Alex: a primeira aula com avatar do curso a retomar, se existir. */
    public function alexUrl(User $user): ?string
    {
        $done = $this->doneIds($user);
        foreach ($this->enrollments($user)->reject(fn ($e) => $this->isExpired($e)) as $e) {
            $lessons = $this->courseLessons($e->course);
            $avatar = $lessons->first(fn ($l) => $l->content_type === 'avatar' && ! $done->has($l->id))
                ?? $lessons->firstWhere('content_type', 'avatar');
            if ($avatar) {
                return $this->lessonUrl($e->course, $avatar);
            }
        }

        return null;
    }

    /** Testes por fazer: ainda sem nota positiva e com tentativas disponíveis. */
    public function pending(User $user): array
    {
        $lessons = $this->enrollments($user)
            ->reject(fn ($e) => $this->isExpired($e))
            ->flatMap(fn ($e) => $this->courseLessons($e->course)->map(fn ($l) => [$l, $e->course]));
        $quizzes = Quiz::withCount('questions')->whereIn('lesson_id', $lessons->map(fn ($x) => $x[0]->id))->get()->keyBy('lesson_id');
        $attempts = QuizAttempt::where('user_id', $user->id)->whereIn('quiz_id', $quizzes->pluck('id'))->get()->groupBy('quiz_id');

        return $lessons->map(function ($pair) use ($quizzes, $attempts) {
            [$lesson, $course] = $pair;
            $quiz = $quizzes->get($lesson->id);
            if (! $quiz) {
                return null;
            }
            $mine = $attempts->get($quiz->id, collect());
            $max = $this->learning->maxAttempts($quiz);
            if ($mine->contains('passed', true) || $mine->count() >= $max) {
                return null;
            }

            return [
                'kind' => 'Teste',
                'title' => $lesson->title,
                'course' => $course->title,
                'text' => __(':questions perguntas · nota mínima :min% · :used de :max tentativas usadas', ['questions' => $quiz->questions_count, 'min' => $quiz->passing_score ?: 70, 'used' => $mine->count(), 'max' => $max]),
                'cta' => $mine->isEmpty() ? __('Fazer o teste') : __('Tentar outra vez'),
                'url' => $this->lessonUrl($course, $lesson),
            ];
        })->filter()->values()->all();
    }

    /** Tentativas dos testes, da mais recente para a mais antiga, com as perguntas a rever. */
    public function results(User $user, ?int $limit = null): array
    {
        $attempts = QuizAttempt::with(['quiz.questions.options', 'quiz.lesson.module.course'])
            ->where('user_id', $user->id)
            ->orderBy('attempted_at')
            ->orderBy('id')
            ->get()
            ->filter(fn ($a) => $a->quiz?->lesson?->module?->course);

        $counter = [];
        $rows = $attempts->map(function (QuizAttempt $a) use (&$counter) {
            $counter[$a->quiz_id] = ($counter[$a->quiz_id] ?? 0) + 1;
            $quiz = $a->quiz;
            $lesson = $quiz->lesson;
            $course = $lesson->module->course;
            $answers = $a->answers ?? [];
            $right = $quiz->questions->filter(fn ($q) => $q->options->firstWhere('id', (int) ($answers[$q->id] ?? 0))?->is_correct);

            return [
                'id' => $a->id,
                'title' => $quiz->title ?: $lesson->title,
                'course' => $course->title,
                'courseId' => $course->instructor_id ? $course->id : null,
                'module' => $lesson->module->title,
                'date' => $a->attempted_at?->translatedFormat('j M'),
                'score' => $a->score,
                'passed' => $a->passed,
                'attempt' => $counter[$a->quiz_id],
                'attempts' => $this->learning->maxAttempts($quiz),
                'minimum' => $quiz->passing_score ?: 70,
                'hasAnswers' => $answers !== [],
                'right' => $right->count(),
                'total' => $quiz->questions->count(),
                'review' => $quiz->questions->reject(fn ($q) => $right->contains('id', $q->id))->pluck('question')->values(),
                'url' => $this->lessonUrl($course, $lesson),
            ];
        })->reverse()->values();

        return ($limit ? $rows->take($limit) : $rows)->all();
    }

    /** Notas do aluno, de todas as aulas. */
    public function notes(User $user): array
    {
        $notes = LessonNote::where('user_id', $user->id)->latest('updated_at')->limit(100)->get();
        $lessons = Lesson::with('module.course')->whereIn('id', $notes->pluck('lesson_id'))->get()->keyBy('id');

        return $notes->map(function ($n) use ($lessons) {
            $lesson = $lessons->get($n->lesson_id);
            $course = $lesson?->module?->course;
            if (! $course) {
                return null;
            }

            return [
                'id' => $n->id,
                'course' => $course->title,
                'lesson' => $lesson->title,
                'at' => $n->position_seconds !== null ? $this->clock($n->position_seconds) : null,
                'body' => $n->body,
                'url' => $this->lessonUrl($course, $lesson),
            ];
        })->filter()->values()->all();
    }

    /** Documentos dos cursos do aluno. Ficam disponíveis para sempre, mesmo depois do fim do acesso. */
    public function documents(User $user): array
    {
        $done = $this->doneIds($user);

        return $this->enrollments($user)->map(function (Enrollment $e) use ($done) {
            $lessons = $this->courseLessons($e->course);
            $files = LessonAttachment::whereIn('lesson_id', $lessons->pluck('id'))->orderBy('order_index')->get()->groupBy('lesson_id');
            $sections = $e->course->modules->map(fn ($m) => [
                'title' => $m->title,
                'files' => $m->lessons->flatMap(fn ($l) => $files->get($l->id, collect())->map(fn ($f) => [
                    'id' => $f->id,
                    'name' => $f->name,
                    'lesson' => $l->title,
                    'size' => $f->size,
                    'type' => $this->fileType($f->name.' '.$f->path),
                    'url' => $f->url(),
                ]))->values(),
            ])->filter(fn ($s) => $s['files']->isNotEmpty())->values();
            $finished = $lessons->filter(fn ($l) => $done->has($l->id))->count();

            return [
                'id' => $e->course->id,
                'title' => $e->course->title,
                'image' => $this->image($e->course),
                'area' => $e->course->category?->name,
                'pct' => $lessons->count() ? (int) floor($finished / $lessons->count() * 100) : 0,
                'count' => $sections->sum(fn ($s) => $s['files']->count()),
                'sections' => $sections,
            ];
        })->all();
    }

    private function fileType(string $name): string
    {
        return match (true) {
            (bool) preg_match('/\.pdf\b/i', $name) => 'PDF',
            (bool) preg_match('/\.(pptx?|key|odp)\b/i', $name) => 'Slides',
            default => 'Outros',
        };
    }

    /** Cursos publicados em que o aluno não está inscrito; primeiro os das áreas que já estuda. */
    /** Primeiro uso: os três cursos publicados mais recentes (reais), para quem ainda não tem nenhum. */
    public function starter(User $user): array
    {
        return Course::with('category')
            ->where('status', 'published')
            ->where(fn ($q) => $q->whereNull('instructor_id')->orWhere('instructor_id', '!=', $user->id))
            ->latest()
            ->take(3)
            ->get()
            ->map(fn (Course $c) => [
                'id' => $c->id,
                'title' => $c->title,
                'area' => $c->category?->name,
                'level' => $c->level,
                'minutes' => $c->duration_minutes,
                'lessons' => $c->lessons()->count(),
                'price' => (float) $c->price,
                'free' => (bool) $c->is_free,
                'image' => $this->image($c),
                'short' => $c->short_description,
                'url' => '/plataforma/cursos/'.$c->slug,
            ])->values()->all();
    }

    public function suggestions(User $user): array
    {
        $enrollments = $this->enrollments($user);
        $areas = $enrollments->map(fn ($e) => $e->course->category_id)->filter()->unique();

        return Course::with('category')
            ->where('status', 'published')
            ->whereNotIn('id', $enrollments->pluck('course_id'))
            ->where(fn ($q) => $q->whereNull('instructor_id')->orWhere('instructor_id', '!=', $user->id))
            ->orderBy('title')
            ->get()
            ->sortBy(fn ($c) => $areas->contains($c->category_id) ? 0 : 1)
            ->take(6)
            ->map(fn (Course $c) => [
                'id' => $c->id,
                'title' => $c->title,
                'area' => $c->category?->name,
                'level' => $c->level,
                'minutes' => $c->duration_minutes,
                'price' => (float) $c->price,
                'free' => (bool) $c->is_free,
                'image' => $this->image($c),
                'why' => $areas->contains($c->category_id) ? __('Na área de :area, que já estudas', ['area' => $c->category?->name]) : null,
                'url' => '/plataforma/cursos/'.$c->slug,
            ])->values()->all();
    }

    /**
     * Conversas com formadores (como aluno) e com alunos (como formador),
     * e os cursos onde o aluno ainda pode começar uma conversa.
     */
    public function messages(User $user): array
    {
        $taught = Course::where('instructor_id', $user->id)->pluck('id');
        $rows = CourseMessage::with(['course.instructor:id,name', 'student:id,name'])
            ->where(fn ($q) => $q->where('student_id', $user->id)->orWhereIn('course_id', $taught))
            ->orderBy('created_at')
            ->orderBy('id')
            ->get()
            ->filter(fn ($m) => $m->course && $m->student);

        $threads = $rows->groupBy(fn ($m) => $m->course_id.'-'.$m->student_id)->map(function ($list, $key) use ($user) {
            $first = $list->first();
            $asStudent = $first->student_id === $user->id;
            $last = $list->last();
            $name = $asStudent ? $first->course->instructor?->name : $first->student->name;

            return [
                'key' => $key,
                'course_id' => $first->course_id,
                'student_id' => $first->student_id,
                'name' => $name ?? __('Formador'),
                'context' => ($asStudent ? __('Formador') : __('Aluno')).' · '.$first->course->title,
                'last' => $last->body,
                'when' => $last->created_at?->diffForHumans(),
                'at' => $last->created_at?->getTimestamp(),
                'unread' => $list->filter(fn ($m) => $m->sender_id !== $user->id && ! $m->read_at)->count(),
                'items' => $list->map(fn ($m) => [
                    'id' => $m->id,
                    'mine' => $m->sender_id === $user->id,
                    'body' => $m->body,
                    'when' => $m->created_at?->diffForHumans(),
                ])->values(),
            ];
        })->sortByDesc('at')->values();

        $started = $threads->where('student_id', $user->id)->pluck('course_id');
        $canStart = $this->enrollments($user)
            ->filter(fn ($e) => $e->course->instructor_id && $e->course->instructor_id !== $user->id && ! $started->contains($e->course_id))
            ->map(fn ($e) => ['id' => $e->course_id, 'title' => $e->course->title])
            ->values();

        return ['threads' => $threads->all(), 'canStart' => $canStart->all()];
    }

    /** Disposição guardada de uma página, para o componente dos painéis. */
    public function layout(User $user, string $view): ?array
    {
        return $user->panel_layouts[$view] ?? null;
    }
}
