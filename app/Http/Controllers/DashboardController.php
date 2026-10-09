<?php

namespace App\Http\Controllers;

use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Lesson;
use App\Models\LessonProgress;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('Dashboard', [
            'greeting' => $this->greeting(),
            'quote' => $this->quote(),
            'ring' => $this->ring($user->id),
            'continueCourse' => $this->continueCourse($user->id),
            'popularCourses' => $this->popularCourses(),
        ]);
    }

    private function greeting(): string
    {
        $hour = (int) now()->format('H');

        return match (true) {
            $hour < 12 => 'Bom dia',
            $hour < 20 => 'Boa tarde',
            default => 'Boa noite',
        };
    }

    private function quote(): string
    {
        return collect([
            'O progresso soma-se a tudo. Continua.',
            'Um pouco todos os dias leva-te longe.',
            'Aprender é a melhor manutenção.',
            'Cada lição é uma ferramenta a mais.',
        ])->random();
    }

    /**
     * Percurso do aluno: lições concluídas vs. total das lições dos cursos inscritos.
     *
     * @return array{percent:int, done:int, total:int}
     */
    private function ring(int $userId): array
    {
        $courseIds = Enrollment::where('user_id', $userId)->pluck('course_id');

        $total = Lesson::whereHas('module', fn ($q) => $q->whereIn('course_id', $courseIds))->count();

        $done = LessonProgress::where('user_id', $userId)
            ->where('status', 'completed')
            ->count();

        $percent = $total > 0 ? (int) round(($done / $total) * 100) : 0;

        return ['percent' => $percent, 'done' => $done, 'total' => $total];
    }

    /**
     * Curso a retomar: inscrição ativa mais recente + progresso desse curso.
     */
    private function continueCourse(int $userId): ?array
    {
        $enrollment = Enrollment::with('course.category')
            ->where('user_id', $userId)
            ->where('status', 'active')
            ->latest('enrolled_at')
            ->first();

        if (! $enrollment || ! $enrollment->course) {
            return null;
        }

        $course = $enrollment->course;
        $total = Lesson::whereHas('module', fn ($q) => $q->where('course_id', $course->id))->count();
        $done = LessonProgress::where('user_id', $userId)
            ->where('status', 'completed')
            ->whereHas('lesson.module', fn ($q) => $q->where('course_id', $course->id))
            ->count();

        return [
            'title' => $course->title,
            'percent' => $total > 0 ? (int) round(($done / $total) * 100) : 0,
            'url' => '/cursos/'.$course->ulid,
            'has_ai' => $course->lessons()->where('content_type', 'avatar')->exists(),
            'category' => ['color_hex' => $course->category?->color_hex],
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function popularCourses(): array
    {
        return Course::with('category')
            ->where('status', 'published')
            ->withCount('enrollments')
            ->withCount(['lessons as ai_count' => fn ($q) => $q->where('content_type', 'avatar')])
            ->orderByDesc('enrollments_count')
            ->latest()
            ->take(8)
            ->get()
            ->map(fn (Course $course) => [
                'id' => $course->id,
                'title' => $course->title,
                'level' => $course->level,
                'duration_minutes' => $course->duration_minutes,
                'url' => '/cursos/'.$course->ulid,
                'has_ai' => $course->ai_count > 0,
                'category' => ['color_hex' => $course->category?->color_hex],
            ])
            ->all();
    }
}
