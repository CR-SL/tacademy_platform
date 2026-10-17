<?php

namespace App\Http\Controllers\Instructor;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Course;
use App\Services\CourseBuilder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * "Os meus cursos": formadores criam e publicam os seus cursos; o admin gere todos.
 * O editor (React) guarda sozinho a cada alteração (update em JSON).
 */
class CourseBuilderController extends Controller
{
    public function __construct(private CourseBuilder $builder) {}

    public function index(Request $request): Response
    {
        $user = $request->user();
        $courses = Course::with(['category', 'instructor'])
            ->withCount('enrollments')
            ->withCount(['enrollments as completed_count' => fn ($q) => $q->where('status', 'completed')])
            ->when(! $user->isAdmin(), fn ($q) => $q->where('instructor_id', $user->id))
            ->latest('updated_at')
            ->get();

        return Inertia::render('Instructor/Courses', [
            'isAdmin' => $user->isAdmin(),
            'courses' => $courses->map(fn (Course $c) => [
                'ulid' => $c->ulid,
                'slug' => $c->slug,
                'title' => $c->title ?: 'Curso sem título',
                'area' => $c->category?->name,
                'level' => $c->level,
                'minutes' => $c->duration_minutes,
                'status' => $c->status,
                'image' => $c->thumbnail_url ?: (config('tacademy.course_images')[$c->slug] ?? null),
                'students' => $c->enrollments_count,
                'completion' => $c->enrollments_count ? (int) round($c->completed_count / $c->enrollments_count * 100) : null,
                'author' => $c->instructor?->name,
                'mine' => $c->instructor_id === $user->id,
                'updated' => $c->updated_at?->diffForHumans(),
            ]),
        ]);
    }

    public function create(): Response
    {
        Gate::authorize('create', Course::class);

        return $this->editor(null);
    }

    /** Primeira gravação de um curso novo (o editor passa depois a usar o update). */
    public function store(Request $request): JsonResponse
    {
        Gate::authorize('create', Course::class);
        $course = new Course(['instructor_id' => $request->user()->id, 'status' => 'draft', 'currency' => 'EUR']);
        $maps = $this->builder->save($course, $this->validated($request));

        return response()->json(['ulid' => $course->ulid, 'slug' => $course->slug, ...$maps], 201);
    }

    public function edit(Course $course): Response
    {
        Gate::authorize('update', $course);

        return $this->editor($course);
    }

    public function update(Request $request, Course $course): JsonResponse
    {
        Gate::authorize('update', $course);
        $maps = $this->builder->save($course, $this->validated($request));

        return response()->json(['ulid' => $course->ulid, 'slug' => $course->slug, ...$maps]);
    }

    public function publish(Course $course): RedirectResponse
    {
        Gate::authorize('update', $course);
        if ($problems = $this->builder->publishProblems($course)) {
            return back()->withErrors(['publish' => 'Falta completar: '.collect($problems)->pluck(0)->implode(', ').'.']);
        }
        $course->update(['status' => 'published']);

        return to_route('instructor.courses.index')->with('status', "“{$course->title}” publicado — já está no catálogo.");
    }

    public function unpublish(Course $course): RedirectResponse
    {
        Gate::authorize('update', $course);
        $course->update(['status' => 'draft']);

        return back()->with('status', 'O curso voltou a rascunho e saiu do catálogo.');
    }

    public function destroy(Course $course): RedirectResponse
    {
        Gate::authorize('delete', $course);
        abort_if($course->status === 'published', 422, 'Passe o curso a rascunho antes de o apagar.');
        $course->delete();

        return to_route('instructor.courses.index')->with('status', 'Rascunho apagado.');
    }

    /** Capa do curso (imagem) ou anexo de uma aula; devolve o caminho para o editor. */
    public function upload(Request $request): JsonResponse
    {
        Gate::authorize('create', Course::class);
        $kind = $request->input('kind');
        $request->validate([
            'kind' => ['required', Rule::in(['cover', 'attachment'])],
            'file' => $kind === 'cover'
                ? ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120']
                : ['required', 'file', 'mimes:pdf,jpg,jpeg,png,webp,doc,docx,xls,xlsx,ppt,pptx,zip', 'max:20480'],
        ], [], ['file' => $kind === 'cover' ? 'imagem' : 'ficheiro']);

        $file = $request->file('file');
        $path = $file->store(CourseBuilder::UPLOAD_DIR.'/'.($kind === 'cover' ? 'capas' : 'anexos'), 'public');

        return response()->json([
            'path' => $path,
            'url' => '/storage/'.$path,
            'name' => $file->getClientOriginalName(),
            'size' => $file->getSize(),
        ]);
    }

    private function editor(?Course $course): Response
    {
        return Inertia::render('Instructor/CourseEditor', [
            'course' => $course ? $this->builder->toEditor($course) : null,
            'problems' => $course ? $this->builder->publishProblems($course) : null,
            'categories' => Category::orderBy('name')->get(['id', 'name']),
            'library' => array_values(array_unique(array_merge(
                array_values(config('tacademy.course_images')),
                array_values(config('tacademy.area_images')),
                ['/images/cursos/cta-motor.jpg', '/images/cursos/cta-oficina.jpg', '/images/cursos/hibridos-eletricos.jpg', '/images/cursos/adas.jpg'],
            ))),
            'shortMax' => CourseBuilder::SHORT_MAX,
        ]);
    }

    private function validated(Request $request): array
    {
        $types = array_merge(CourseBuilder::LESSON_TYPES, ['video_upload', 'live']); // aulas antigas do backoffice

        return $request->validate([
            'title' => ['nullable', 'string', 'max:200'],
            'category_id' => ['nullable', 'integer', 'exists:categories,id'],
            'level' => ['nullable', Rule::in(['iniciante', 'intermedio', 'avancado'])],
            // Só imagens da biblioteca ou carregadas pelo próprio editor
            'thumbnail_url' => ['nullable', 'string', 'max:255', 'regex:#^/(images/cursos|storage/'.CourseBuilder::UPLOAD_DIR.'/capas)/[\w.\-]+$#'],
            'short_description' => ['nullable', 'string', 'max:200'],
            'description' => ['nullable', 'string', 'max:10000'],
            'learning_outcomes' => ['array', 'max:20'],
            'learning_outcomes.*' => ['nullable', 'string', 'max:200'],
            'prerequisites' => ['nullable', 'string', 'max:255'],
            'audience' => ['nullable', 'string', 'max:255'],
            'is_free' => ['boolean'],
            'price' => ['nullable', 'numeric', 'min:0', 'max:99999'],
            'access_months' => ['nullable', Rule::in(CourseBuilder::ACCESS_MONTHS)],
            'sequential' => ['boolean'],
            'certificate_enabled' => ['boolean'],
            'certificate_min_progress' => ['integer', 'between:0,100'],
            'certificate_min_score' => ['integer', 'between:0,100'],
            'sample_lesson_key' => ['nullable', 'string', 'max:40'],
            'modules' => ['array', 'max:50'],
            'modules.*.key' => ['required', 'string', 'max:40'],
            'modules.*.id' => ['nullable', 'integer'],
            'modules.*.title' => ['nullable', 'string', 'max:200'],
            'modules.*.description' => ['nullable', 'string', 'max:1000'],
            'modules.*.lessons' => ['array', 'max:100'],
            'modules.*.lessons.*.key' => ['required', 'string', 'max:40'],
            'modules.*.lessons.*.id' => ['nullable', 'integer'],
            'modules.*.lessons.*.title' => ['nullable', 'string', 'max:200'],
            'modules.*.lessons.*.type' => ['required', Rule::in($types)],
            'modules.*.lessons.*.url' => ['nullable', 'string', 'max:500'],
            'modules.*.lessons.*.minutes' => ['nullable', 'integer', 'between:0,600'],
            'modules.*.lessons.*.body' => ['nullable', 'string', 'max:50000'],
            'modules.*.lessons.*.attachments' => ['array', 'max:20'],
            'modules.*.lessons.*.attachments.*.path' => ['required', 'string', 'max:300'],
            'modules.*.lessons.*.attachments.*.name' => ['nullable', 'string', 'max:200'],
            'modules.*.lessons.*.quiz' => ['array', 'max:50'],
            'modules.*.lessons.*.quiz.*.question' => ['nullable', 'string', 'max:500'],
            'modules.*.lessons.*.quiz.*.options' => ['array', 'max:8'],
            'modules.*.lessons.*.quiz.*.options.*' => ['nullable', 'string', 'max:300'],
            'modules.*.lessons.*.quiz.*.correct' => ['integer', 'min:0'],
        ]);
    }
}
