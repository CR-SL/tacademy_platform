<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AlexConversation;
use App\Models\Course;
use App\Models\Role;
use App\Models\User;
use App\Services\AdminStats;
use App\Support\Permissions;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Administração (substituiu o back office antigo): menu lateral com estatísticas, catálogo,
 * pessoas e permissões. Cada secção pede a sua permissão; o menu só mostra as que a pessoa tem.
 */
class AdminController extends Controller
{
    public const SECTIONS = ['geral', 'vendas', 'cliques', 'conclusao', 'catalogo', 'formador-ia', 'pessoas', 'permissoes'];

    private const NEEDS = [
        'geral' => 'estatisticas', 'vendas' => 'estatisticas', 'cliques' => 'estatisticas', 'conclusao' => 'estatisticas',
        'catalogo' => 'cursos.todos', 'formador-ia' => 'cursos.alex.gerir', 'pessoas' => 'pessoas', 'permissoes' => 'pessoas',
    ];

    public function __construct(private AdminStats $stats) {}

    public function index(Request $request, ?string $section = null): Response|RedirectResponse
    {
        $user = $request->user();
        $allowed = array_values(array_filter(self::SECTIONS, fn ($s) => $user->canDo(self::NEEDS[$s])));
        abort_if($allowed === [], 403);
        $section ??= $allowed[0];
        if (! in_array($section, $allowed, true)) {
            return to_route('admin.index', ['section' => $allowed[0]]);
        }

        return Inertia::render('Admin/Index', [
            'section' => $section,
            'sections' => $allowed,
            'days' => AdminStats::DAYS,
            'data' => fn () => match ($section) {
                'geral' => [
                    'overview' => $this->stats->overview(),
                    'attention' => $this->stats->attention(),
                    'months' => $this->stats->salesByMonth(),
                    'catalog' => $this->stats->catalog(),
                    'completion' => $this->stats->completion()->values(),
                ],
                'vendas' => [
                    'overview' => $this->stats->overview(),
                    'months' => $this->stats->salesByMonth(),
                    'byCourse' => $this->stats->salesByCourse()->map(fn ($r) => [...$r, 'ulid' => Course::find($r['id'])?->ulid]),
                ],
                'cliques' => ['catalog' => $this->stats->catalog()],
                'catalogo' => [
                    'catalog' => $this->stats->catalog(),
                    'areas' => \App\Models\Category::withCount('courses')->orderBy('name')->get(['id', 'name', 'slug']),
                ],
                'conclusao' => ['completion' => $this->stats->completion()->values()],
                'formador-ia' => $this->alexCourses($request),
                'pessoas' => $this->people($request),
                'permissoes' => $this->permissions(),
            },
        ]);
    }

    /** Página de um curso: cliques, compras, percurso e alunos. */
    public function course(Request $request, Course $course): Response
    {
        $course->loadMissing(['category', 'instructor']);

        return Inertia::render('Admin/Course', [
            'course' => [
                'ulid' => $course->ulid,
                'slug' => $course->slug,
                'title' => $course->title ?: __('Curso sem título'),
                'area' => $course->category?->name,
                'instructor' => $course->instructor?->name,
                'status' => $course->status,
                'price' => (float) $course->price,
                'free' => (bool) $course->is_free,
                'image' => $course->thumbnail_url ?: (config('tacademy.course_images')[$course->slug] ?? config('tacademy.course_image_fallback')),
                'canEdit' => $request->user()->can('update', $course),
            ],
            'stats' => $this->stats->course($course),
            'days' => AdminStats::DAYS,
        ]);
    }

    /** Formador IA: cursos com o avatar ligado ou bloqueado, e as conversas dos últimos 30 dias. */
    private function alexCourses(Request $request): array
    {
        $since = now()->subDays(30);
        $talks = AlexConversation::where('created_at', '>=', $since)->whereNotNull('course_id')
            ->whereIn('status', ['active', 'ended'])->get(['course_id', 'created_at', 'ended_at'])->groupBy('course_id');

        return [
            'courses' => Course::with('instructor')
                ->where(fn ($q) => $q->where('alex_enabled', true)->orWhere('alex_blocked', true))
                ->orderByDesc('alex_enabled')->orderBy('title')->get()
                ->map(fn (Course $c) => [
                    'ulid' => $c->ulid,
                    'title' => $c->title ?: __('Curso sem título'),
                    'instructor' => $c->instructor?->name,
                    'status' => $c->status,
                    'enabled' => (bool) $c->alex_enabled,
                    'blocked' => (bool) $c->alex_blocked,
                    'ownPal' => (bool) $c->alex_pal_id,
                    'talks' => $talks->get($c->id)?->count() ?? 0,
                    'minutes' => (int) round(($talks->get($c->id) ?? collect())->sum(
                        fn ($t) => $t->ended_at ? $t->created_at->diffInSeconds($t->ended_at) : 0,
                    ) / 60),
                    'canEdit' => $request->user()->can('update', $c),
                ])->values(),
        ];
    }

    /** Formador IA: desligar e bloquear o avatar num curso, ou desbloquear (fica desligado até o formador o ligar). */
    public function alex(Request $request, Course $course): RedirectResponse
    {
        $blocked = $request->validate(['blocked' => ['required', 'boolean']])['blocked'];
        $course->forceFill($blocked ? ['alex_enabled' => false, 'alex_blocked' => true] : ['alex_blocked' => false])->save();

        return back()->with('status', $blocked
            ? __('Avatar desligado em “:title”. O formador já não o pode ligar.', ['title' => $course->title ?: __('Curso sem título')])
            : __('“:title” desbloqueado. O formador pode voltar a ligar o avatar.', ['title' => $course->title ?: __('Curso sem título')]));
    }

    private function people(Request $request): array
    {
        $q = trim((string) $request->query('q', ''));
        $role = $request->query('perfil');
        $filter = $request->query('filtro');
        $users = User::withTrashed()->with(['role', 'company'])->withCount('enrollments')
            ->when($q !== '', fn ($w) => $w->where(fn ($x) => $x->where('name', 'like', "%{$q}%")->orWhere('email', 'like', "%{$q}%")))
            ->when($role, fn ($w) => $w->whereHas('role', fn ($r) => $r->where('name', $role)))
            ->when($filter === 'desativadas', fn ($w) => $w->onlyTrashed())
            ->when($filter === 'nunca', fn ($w) => $w->whereNull('last_active_at'))
            ->orderByRaw('deleted_at is not null')->orderBy('name')
            ->paginate(25)->withQueryString();

        return [
            'users' => $users->through(fn (User $u) => [
                'id' => $u->id,
                'ulid' => $u->ulid,
                'name' => $u->name,
                'email' => $u->email,
                'role' => $u->role?->name,
                'company' => $u->company?->name,
                'courses' => $u->enrollments_count,
                'last' => $u->last_active_at?->diffForHumans(),
                'disabled' => $u->trashed(),
                'me' => $u->id === $request->user()->id,
            ]),
            'counts' => Role::withCount('users')->pluck('users_count', 'name'),
            'roles' => $this->roles(),
            'filters' => ['q' => $q, 'perfil' => $role, 'filtro' => $filter],
        ];
    }

    private function permissions(): array
    {
        return [
            'roles' => $this->roles(),
            'permissions' => collect(Permissions::ALL)->map(fn ($label, $key) => ['key' => $key, 'label' => __($label)])->values(),
            'granted' => Role::all()->mapWithKeys(fn (Role $r) => [$r->name => $r->permissionKeys()]),
        ];
    }

    private function roles(): array
    {
        return collect(Permissions::ROLES)->map(fn ($r, $key) => ['key' => $key, 'name' => __($r[0]), 'about' => __($r[1])])->values()->all();
    }
}
