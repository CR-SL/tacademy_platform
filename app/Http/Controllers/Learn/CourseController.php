<?php

namespace App\Http\Controllers\Learn;

use App\Http\Controllers\Controller;
use App\Models\ContactRequest;
use App\Models\Course;
use App\Services\LearningService;
use App\Services\StudentArea;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Pré-visualização do curso pela equipa; os alunos são levados para "Os meus cursos" ou para o catálogo. */
class CourseController extends Controller
{
    use BuildsProgram;

    public function __construct(private LearningService $learning) {}

    public function __invoke(Request $request, Course $course, StudentArea $area): Response|RedirectResponse
    {
        $user = $request->user();
        $access = $this->learning->access($user, $course);
        abort_unless($course->status === 'published' || $access['mode'] === 'preview', 404);

        // A página do curso saiu (2026-11-13): quem tem o curso vê-o na caixa lateral de "Os meus cursos";
        // quem não o tem, na caixa do catálogo. Fica só a pré-visualização da equipa (formador e gestão).
        if ($access['mode'] !== 'preview') {
            $request->session()->reflash();

            return redirect($access['enrollment']
                ? '/plataforma/meus-cursos?curso='.urlencode($course->slug)
                : '/plataforma/cursos?curso='.urlencode($course->slug));
        }

        $lessons = $this->learning->lessons($course);
        $done = $access['mode'] === 'enrolled' ? $this->learning->completedIds($user, $lessons) : collect();
        $next = $lessons->first(fn ($l) => ! $done->contains($l->id) && $this->learning->canOpen($access, $course, $l))
            ?? $lessons->first();
        $sample = $lessons->firstWhere('id', $course->sample_lesson_id);
        $enrollment = $access['mode'] === 'enrolled' ? $access['enrollment']?->setRelation('course', $course) : null;
        $course->loadMissing(['category', 'instructor']);

        return Inertia::render('Learn/Course', [
            'course' => [
                'slug' => $course->slug,
                'ulid' => $course->ulid,
                'title' => $course->title,
                'area' => $course->category?->name,
                'level' => $course->level,
                'image' => $course->thumbnail_url ?: (config('tacademy.course_images')[$course->slug] ?? config('tacademy.course_image_fallback')),
                'short' => $course->short_description,
                'description' => $course->description,
                'learn' => $course->learning_outcomes ?? [],
                'prerequisites' => $course->prerequisites,
                'audience' => $course->audience,
                'instructor' => $course->instructor?->name,
                'minutes' => $course->duration_minutes,
                'lessons' => $lessons->count(),
                'price' => (float) $course->price,
                'is_free' => $course->is_free,
                'access_months' => $course->access_months,
                'attendance' => (bool) $course->requires_attendance,
            ],
            'access' => [
                'mode' => $access['mode'],
                'expires' => $access['expires_at']?->format('d/m/Y'),
                'deadline' => $enrollment?->deadlineInfo($lessons->isNotEmpty() && $done->count() === $lessons->count()),
                'pending' => $access['mode'] === 'none' && ContactRequest::where('user_id', $user->id)->where('course_id', $course->id)
                    ->where('kind', 'compra')->whereIn('status', ContactRequest::OPEN)->exists(),
            ],
            'progress' => [
                'done' => $done->count(),
                'percent' => $lessons->count() ? (int) floor($done->count() / $lessons->count() * 100) : 0,
            ],
            'program' => $this->program($course, $lessons, $done, $access, null, $access['mode'] === 'enrolled' ? $this->startedVideos($user, $lessons) : null),
            'next' => $next ? ['ulid' => $next->ulid, 'title' => $next->title, 'started' => $done->isNotEmpty(), 'finished' => $lessons->isNotEmpty() && $done->count() === $lessons->count()] : null,
            'sample' => $sample && $access['mode'] === 'none' ? ['ulid' => $sample->ulid, 'title' => $sample->title] : null,
            'certificate' => $this->learning->certificateStatus($user, $course, $lessons, $done),
            'alexUrl' => $area->alexUrl($user),
            'savedLayout' => $area->layout($user, 'curso'),
        ]);
    }
}
