<?php

namespace App\Services;

use App\Models\Course;
use App\Models\CourseMessage;
use App\Models\Quiz;
use App\Models\QuizAttempt;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * Área do formador (opção D da navegação, 2026-11-09): o Início e as Avaliações de quem dá cursos.
 * Só os cursos de que a pessoa é formadora. Só dados reais.
 */
class InstructorArea
{
    public function __construct(private LearningService $learning, private Tasks $tasks) {}

    /** Os cursos do formador, com o que cada um tem pendente (presenças, mensagens por ler, rascunho). */
    public function courses(User $user): array
    {
        $courses = Course::with('category')->withCount('enrollments')
            ->where('instructor_id', $user->id)->latest('updated_at')->get();
        $unread = CourseMessage::whereIn('course_id', $courses->pluck('id'))
            ->where('sender_id', '!=', $user->id)->whereNull('read_at')
            ->selectRaw('course_id, count(*) as n')->groupBy('course_id')->pluck('n', 'course_id');
        $waiting = collect($this->tasks->attendanceWaiting($user))->mapWithKeys(fn ($r) => [$r['course']->id => $r['count']]);

        return $courses->map(fn (Course $c) => [
            'ulid' => $c->ulid,
            'slug' => $c->slug,
            'title' => $c->title ?: __('Curso sem título'),
            'area' => $c->category?->name,
            'status' => $c->status,
            'image' => $c->thumbnail_url ?: (config('tacademy.course_images')[$c->slug] ?? null),
            'students' => $c->enrollments_count,
            'attendance' => (int) ($waiting[$c->id] ?? 0),
            'unread' => (int) ($unread[$c->id] ?? 0),
        ])->values()->all();
    }

    /**
     * Resultados dos quizzes dos alunos dos cursos do formador: uma linha por aluno e quiz
     * (a melhor nota e as tentativas). Precisa de atenção = ainda não passou.
     */
    public function assessments(User $user): Collection
    {
        $quizzes = Quiz::with('lesson.module.course')
            ->whereHas('lesson.module.course', fn ($q) => $q->where('instructor_id', $user->id))
            ->get()->keyBy('id');
        if ($quizzes->isEmpty()) {
            return collect();
        }
        $attempts = QuizAttempt::whereIn('quiz_id', $quizzes->keys())->orderBy('attempted_at')->get();
        $names = User::whereIn('id', $attempts->pluck('user_id')->unique())->pluck('name', 'id');

        return $attempts->groupBy(fn ($a) => $a->user_id.'-'.$a->quiz_id)->map(function ($list) use ($quizzes, $names) {
            $first = $list->first();
            $quiz = $quizzes[$first->quiz_id];
            $course = $quiz->lesson?->module?->course;
            $last = $list->last();
            $passed = $list->contains('passed', true);
            $max = $this->learning->maxAttempts($quiz);

            return [
                'key' => $first->user_id.'-'.$first->quiz_id,
                'student' => $names[$first->user_id] ?? __('Aluno'),
                'studentId' => $first->user_id,
                'quiz' => $quiz->title,
                'course' => $course?->title,
                'courseUlid' => $course?->ulid,
                'best' => (int) $list->max('score'),
                'last' => (int) $last->score,
                'minimum' => (int) $quiz->passing_score,
                'attempts' => $list->count(),
                'max' => $max,
                'passed' => $passed,
                'out' => ! $passed && $list->count() >= $max, // sem tentativas
                'when' => $last->attempted_at?->diffForHumans(),
                'at' => $last->attempted_at?->getTimestamp(),
            ];
        })->sortByDesc('at')->values();
    }

    /** Resumo por curso: quantos alunos fizeram quizzes, a média das melhores notas e quantos ainda não passaram. */
    public function byCourse(Collection $rows): array
    {
        return $rows->groupBy('courseUlid')->map(fn ($list) => [
            'ulid' => $list->first()['courseUlid'],
            'title' => $list->first()['course'],
            'students' => $list->pluck('studentId')->unique()->count(),
            'average' => (int) round($list->avg('best')),
            'notPassed' => $list->where('passed', false)->count(),
        ])->sortByDesc('notPassed')->values()->all();
    }

    /** Número da navegação: resultados que precisam de atenção. */
    public function attentionCount(User $user): int
    {
        return $this->assessments($user)->where('passed', false)->count();
    }
}
