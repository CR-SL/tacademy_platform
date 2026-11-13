<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Learn\BuildsProgram;
use App\Models\Course;
use App\Models\User;
use App\Services\LearningService;
use App\Services\StudentArea;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Páginas em painéis do aluno: os meus cursos, avaliações e documentos. */
class StudentAreaController extends Controller
{
    use BuildsProgram;

    public function __construct(private StudentArea $area, private LearningService $learning) {}

    public function courses(Request $request): Response
    {
        $slug = (string) $request->query('curso', '');

        return Inertia::render('Student/MyCourses', [
            'courses' => $this->area->courses($request->user()),
            // Caixa lateral do curso aberto (?curso=slug); vem também sozinha, ao abrir um cartão
            'detail' => fn () => $slug !== '' ? $this->detail($request->user(), $slug) : null,
            'alexUrl' => $this->area->alexUrl($request->user()),
            'savedLayout' => $this->area->layout($request->user(), 'cursos'),
        ]);
    }

    public function assessments(Request $request): Response
    {
        return Inertia::render('Student/Assessments', [
            'results' => $this->area->results($request->user()),
            'alexUrl' => $this->area->alexUrl($request->user()),
            'savedLayout' => $this->area->layout($request->user(), 'avaliacoes'),
        ]);
    }

    /**
     * Tudo o que a antiga página do curso mostrava a quem o tem: progresso, programa com o estado
     * de cada aula, a aula a seguir, o certificado e a apresentação. Só para cursos do próprio aluno.
     */
    private function detail(User $user, string $slug): ?array
    {
        $course = Course::with(['category', 'instructor'])->where('slug', $slug)->first();
        if (! $course) {
            return null;
        }
        $access = $this->learning->access($user, $course);
        if (! $access['enrollment']) {
            return null;
        }
        $mode = $access['mode'] === 'enrolled' ? 'enrolled' : 'expired';
        $lessons = $this->learning->lessons($course);
        $done = $this->learning->completedIds($user, $lessons);
        $finished = $lessons->isNotEmpty() && $done->count() === $lessons->count();
        $next = $mode === 'enrolled' ? ($lessons->first(fn ($l) => ! $done->contains($l->id)) ?? $lessons->first()) : null;
        $enrollment = $access['enrollment']->setRelation('course', $course);
        $access['mode'] = $mode;

        return [
            'course' => [
                'slug' => $course->slug,
                'title' => $course->title,
                'area' => $course->category?->name,
                'level' => $course->level,
                'image' => $course->thumbnail_url ?: (config('tacademy.course_images')[$course->slug] ?? config('tacademy.course_image_fallback')),
                'description' => $course->description,
                'learn' => $course->learning_outcomes ?? [],
                'prerequisites' => $course->prerequisites,
                'audience' => $course->audience,
                'instructor' => $course->instructor?->name,
                'minutes' => (int) $course->duration_minutes,
                'attendance' => (bool) $course->requires_attendance,
            ],
            'access' => [
                'mode' => $mode,
                'expires' => $access['expires_at']?->format('d/m/Y'),
                'company' => $enrollment->company_id !== null,
                'deadline' => $mode === 'enrolled' ? $enrollment->deadlineInfo($finished) : null,
            ],
            'progress' => [
                'done' => $done->count(),
                'total' => $lessons->count(),
                'percent' => $lessons->count() ? (int) floor($done->count() / $lessons->count() * 100) : 0,
            ],
            'program' => $this->program($course, $lessons, $done, $access, null, $this->startedVideos($user, $lessons)),
            'next' => $next ? ['ulid' => $next->ulid, 'title' => $next->title, 'started' => $done->isNotEmpty(), 'finished' => $finished] : null,
            'certificate' => $this->learning->certificateStatus($user, $course, $lessons, $done),
        ];
    }

    public function certificates(Request $request): Response
    {
        return Inertia::render('Student/Certificates', $this->area->certificates($request->user()));
    }

    public function documents(Request $request): Response
    {
        return Inertia::render('Student/Documents', [
            'courses' => $this->area->documents($request->user()),
            'alexUrl' => $this->area->alexUrl($request->user()),
            'savedLayout' => $this->area->layout($request->user(), 'documentos'),
        ]);
    }
}
