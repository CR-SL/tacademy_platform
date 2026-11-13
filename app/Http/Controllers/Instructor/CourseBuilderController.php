<?php

namespace App\Http\Controllers\Instructor;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Certificate;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\User;
use App\Services\LearningService;
use App\Services\CourseBuilder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
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
            ->when(! $user->canDo('cursos.todos'), fn ($q) => $q->where('instructor_id', $user->id))
            ->latest('updated_at')
            ->get();

        return Inertia::render('Instructor/Courses', [
            'isAdmin' => $user->canDo('cursos.todos'), // vê e edita os cursos de todos
            'courses' => $courses->map(fn (Course $c) => [
                'ulid' => $c->ulid,
                'slug' => $c->slug,
                'title' => $c->title ?: __('Curso sem título'),
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
                'attendance' => (bool) $c->requires_attendance,
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
        Gate::authorize('publish', $course);
        if ($problems = $this->builder->publishProblems($course)) {
            return back()->withErrors(['publish' => __('Falta completar: :items.', ['items' => collect($problems)->pluck(0)->map(fn ($p) => __($p))->implode(', ')])]);
        }
        $course->update(['status' => 'published']);

        return to_route('instructor.courses.index')->with('status', __('“:title” publicado. Já está no catálogo.', ['title' => $course->title]));
    }

    public function unpublish(Course $course): RedirectResponse
    {
        Gate::authorize('update', $course);
        $course->update(['status' => 'draft']);

        return back()->with('status', __('O curso voltou a rascunho e saiu do catálogo.'));
    }

    public function destroy(Course $course): RedirectResponse
    {
        Gate::authorize('delete', $course);
        abort_if($course->status === 'published', 422, __('Passe o curso a rascunho antes de o apagar.'));
        $course->delete();

        return to_route('instructor.courses.index')->with('status', __('Rascunho apagado.'));
    }

    /** Alunos do curso, com o progresso e a presença, para o formador confirmar quem esteve presente. */
    public function students(Course $course, LearningService $learning): JsonResponse
    {
        Gate::authorize('update', $course);
        $lessons = $learning->lessons($course);
        $enrollments = Enrollment::with('user:id,ulid,name,email')->where('course_id', $course->id)->get()
            ->filter(fn ($e) => $e->user)->sortBy(fn ($e) => $e->user->name, SORT_NATURAL | SORT_FLAG_CASE);

        return response()->json([
            'students' => $enrollments->map(fn (Enrollment $e) => $this->studentRow($e, $lessons, $learning))->values(),
        ]);
    }

    /** Confirma (ou retira) a presença de um aluno. Com a presença confirmada, o certificado sai se o resto estiver cumprido. */
    public function attendance(Request $request, Course $course, User $student, LearningService $learning): JsonResponse
    {
        Gate::authorize('update', $course);
        $data = $request->validate(['attended' => ['required', 'boolean']]);
        $e = Enrollment::with('user:id,ulid,name,email')->where('course_id', $course->id)->where('user_id', $student->id)->firstOrFail();
        $e->forceFill(['attended_at' => $data['attended'] ? ($e->attended_at ?? now()) : null])->save();
        if ($data['attended']) {
            $learning->afterProgress($student, $course);
        }

        return response()->json(['student' => $this->studentRow($e, $learning->lessons($course), $learning)]);
    }

    private function studentRow(Enrollment $e, $lessons, LearningService $learning): array
    {
        $done = $learning->completedIds($e->user, $lessons)->count();

        return [
            'id' => $e->user->id,
            'ulid' => $e->user->ulid,
            'name' => $e->user->name,
            'email' => $e->user->email,
            'progress' => $lessons->count() ? (int) floor($done / $lessons->count() * 100) : 0,
            'attended' => $e->attended_at?->format('d/m/Y'),
            'certificate' => Certificate::where('user_id', $e->user_id)->where('course_id', $e->course_id)->where('status', 'valid')->exists(),
        ];
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

    /**
     * Vídeo da aula (MP4 ou WebM), enviado aos pedaços de CourseBuilder::VIDEO_CHUNK_BYTES.
     * Os pedaços juntam-se num ficheiro temporário; no último, o vídeo passa para o disco public
     * (cursos/videos/…) e devolve o endereço que fica no link da aula.
     */
    public function uploadVideo(Request $request): JsonResponse
    {
        Gate::authorize('create', Course::class);
        $maxBytes = config('tacademy.video_max_mb') * 1024 * 1024;
        $data = $request->validate([
            'id' => ['required', 'uuid'],
            'index' => ['required', 'integer', 'min:0'],
            'total' => ['required', 'integer', 'min:1', 'max:'.(int) ceil($maxBytes / CourseBuilder::VIDEO_CHUNK_BYTES)],
            'size' => ['required', 'integer', 'min:1', 'max:'.$maxBytes],
            'name' => ['required', 'string', 'max:255', 'regex:/\.(mp4|webm)$/i'],
            'chunk' => ['required', 'file', 'max:'.(int) ceil(CourseBuilder::VIDEO_CHUNK_BYTES / 1024)],
        ], [
            'name.regex' => __('O vídeo tem de ser MP4 ou WebM.'),
            'size.max' => __('O vídeo não pode ter mais de :mb MB.', ['mb' => config('tacademy.video_max_mb')]),
        ]);
        // Os campos chegam como texto (FormData)
        [$index, $total, $size] = [(int) $data['index'], (int) $data['total'], (int) $data['size']];
        abort_unless($index < $total, 422);

        // Ficheiro temporário por formador e envio; cada pedaço tem de chegar pela ordem certa
        $tmp = Storage::disk('local');
        $part = 'video-uploads/'.$request->user()->id.'-'.$data['id'].'.part';
        if ($index === 0) $tmp->delete($part);
        $have = $tmp->exists($part) ? $tmp->size($part) : 0;
        if ($have !== $index * CourseBuilder::VIDEO_CHUNK_BYTES) {
            return response()->json(['message' => __('O envio foi interrompido. Tenta carregar o vídeo outra vez.')], 409);
        }
        $tmp->makeDirectory('video-uploads');
        file_put_contents($tmp->path($part), $request->file('chunk')->get(), FILE_APPEND | LOCK_EX);

        if ($index < $total - 1) {
            return response()->json(['done' => false]);
        }

        // Último pedaço: confirma o tamanho e o tipo real do ficheiro antes de o publicar
        $path = $tmp->path($part);
        clearstatcache(true, $path);
        $mime = mime_content_type($path) ?: '';
        if (filesize($path) !== $size || ! in_array($mime, ['video/mp4', 'video/webm', 'video/x-m4v'], true)) {
            $tmp->delete($part);

            return response()->json(['message' => $mime === 'video/quicktime'
                ? __('Este ficheiro é .mov. Exporta o vídeo em MP4 (H.264) e tenta outra vez.')
                : __('O ficheiro não é um vídeo MP4 ou WebM válido.')], 422);
        }
        $ext = $mime === 'video/webm' ? 'webm' : 'mp4';
        $final = CourseBuilder::VIDEO_DIR.'/'.Str::lower((string) Str::ulid()).'.'.$ext;
        $in = fopen($path, 'rb');
        Storage::disk('public')->writeStream($final, $in); // o volume pode ser outro disco: copiar em vez de mover
        fclose($in);
        $tmp->delete($part);

        return response()->json([
            'done' => true,
            'url' => '/storage/'.$final,
            'name' => $data['name'],
            'size' => $size,
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
                ['/images/cursos/cta-motor.jpg', '/images/cursos/cta-oficina.jpg', '/images/cursos/hibridos-eletricos.jpg', '/images/cursos/adas.jpg',
                    '/images/cursos/airbags.jpg', '/images/cursos/baterias-alta-tensao.jpg', '/images/cursos/climatizacao.jpg', '/images/cursos/colisoes-estrutura.jpg',
                    '/images/cursos/geometria-suspensao.jpg', '/images/cursos/pintura.jpg', '/images/cursos/travagem-abs.jpg'],
            ))),
            'shortMax' => CourseBuilder::SHORT_MAX,
            // Só o admin e o gestor de cursos ligam o formador IA (Alex): custa minutos no Tavus
            'canAlex' => (bool) request()->user()?->canDo('cursos.alex'),
            'videoMaxMb' => config('tacademy.video_max_mb'),
        ]);
    }

    private function validated(Request $request): array
    {
        $types = array_merge(CourseBuilder::LESSON_TYPES, ['video_upload', 'live']); // aulas antigas do backoffice

        $data = $request->validate([
            'title' => ['nullable', 'string', 'max:200'],
            'category_id' => ['nullable', 'integer', 'exists:categories,id'],
            'level' => ['nullable', Rule::in(array_keys(Course::LEVELS))],
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
            // O prazo cabe sempre dentro da validade do acesso
            'deadline_days' => ['nullable', Rule::in(CourseBuilder::DEADLINE_DAYS), function ($attr, $value, $fail) use ($request) {
                $months = $request->input('access_months');
                if ($value && $months && $value > $months * 30) $fail(__('O prazo não pode ser maior do que a validade do acesso.'));
            }],
            'requires_attendance' => ['boolean'],
            'alex_enabled' => ['boolean'],
            'alex_pal_id' => ['nullable', 'string', 'max:64', 'regex:/^[A-Za-z0-9_-]+$/'],
            'alex_face_id' => ['nullable', 'string', 'max:64', 'regex:/^[A-Za-z0-9_-]+$/'],
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
            'modules.*.lessons.*.checks' => ['array', 'max:5'],
            'modules.*.lessons.*.checks.*.question' => ['nullable', 'string', 'max:500'],
            'modules.*.lessons.*.checks.*.options' => ['array', 'max:4'],
            'modules.*.lessons.*.checks.*.options.*' => ['nullable', 'string', 'max:300'],
            'modules.*.lessons.*.checks.*.correct' => ['integer', 'min:0'],
            'modules.*.lessons.*.checks.*.explanation' => ['nullable', 'string', 'max:500'],
        ]);

        if (! $request->user()->canDo('cursos.alex')) {
            unset($data['alex_enabled'], $data['alex_pal_id'], $data['alex_face_id']);
        }

        return $data;
    }
}
