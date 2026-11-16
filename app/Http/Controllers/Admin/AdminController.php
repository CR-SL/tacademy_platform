<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\AlexConversation;
use App\Models\Course;
use App\Models\Role;
use App\Models\User;
use App\Services\AdminStats;
use App\Support\Activity;
use App\Support\Permissions;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Administração (substituiu o back office antigo): menu lateral com estatísticas, catálogo,
 * pessoas e permissões. Cada secção pede a sua permissão; o menu só mostra as que a pessoa tem.
 */
class AdminController extends Controller
{
    public const SECTIONS = ['geral', 'vendas', 'cliques', 'conclusao', 'catalogo', 'formador-ia', 'pessoas', 'permissoes', 'registo'];

    private const NEEDS = [
        'geral' => 'estatisticas', 'vendas' => 'estatisticas', 'cliques' => 'estatisticas', 'conclusao' => 'estatisticas',
        'catalogo' => 'cursos.todos', 'formador-ia' => 'cursos.alex.gerir', 'pessoas' => 'pessoas',
        'permissoes' => null, // só o admin: quem muda permissões podia dar a si próprio todas as outras
        'registo' => null, // só o admin (decisão do utilizador): não é uma permissão que se dê a outros perfis
    ];

    /** Uma secção está aberta a esta pessoa? */
    private static function opens(User $user, string $section): bool
    {
        return self::NEEDS[$section] === null ? $user->isAdmin() : $user->canDo(self::NEEDS[$section]);
    }

    public function __construct(private AdminStats $stats) {}

    public function index(Request $request, ?string $section = null): Response|RedirectResponse
    {
        $user = $request->user();
        $allowed = array_values(array_filter(self::SECTIONS, fn ($s) => self::opens($user, $s)));
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
                'registo' => $this->activity($request),
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

    /* ---------- Registo de atividade (só o admin) ---------- */

    /** Períodos que se podem escolher, em dias. */
    public const LOG_PERIODS = [1, 7, 30, 365];

    /** Filtros do registo, iguais na página e na exportação. */
    private function activityFilters(Request $request): array
    {
        $period = (int) $request->query('periodo', 7);

        return [
            'q' => trim((string) $request->query('q', '')),
            'ip' => trim((string) $request->query('ip', '')),
            'grupo' => array_key_exists((string) $request->query('grupo'), Activity::GROUPS) || $request->query('grupo') === 'vigiar' ? $request->query('grupo') : null,
            'pessoa' => $request->integer('pessoa') ?: null,
            'periodo' => in_array($period, self::LOG_PERIODS, true) ? $period : 7,
        ];
    }

    private function activityQuery(array $f)
    {
        return ActivityLog::query()
            ->where('created_at', '>=', now()->subDays($f['periodo']))
            ->when($f['grupo'], fn ($w) => $w->whereIn('action', Activity::actionsIn($f['grupo'])))
            ->when($f['ip'] !== '', fn ($w) => $w->where('ip', 'like', $f['ip'].'%'))
            ->when($f['pessoa'], fn ($w) => $w->where(fn ($x) => $x->where('user_id', $f['pessoa'])->orWhere('related_user_id', $f['pessoa'])))
            ->when($f['q'] !== '', function ($w) use ($f) {
                $like = '%'.$f['q'].'%';
                $w->where(fn ($x) => $x->where('user_name', 'like', $like)->orWhere('subject_label', 'like', $like)
                    ->orWhere('ip', 'like', $like)->orWhere('properties', 'like', $like)
                    ->orWhereHas('relatedUser', fn ($u) => $u->where('name', 'like', $like)->orWhere('email', 'like', $like)));
            })
            ->with(['relatedUser:id,name,role_id', 'relatedUser.role:id,name'])
            ->latest('created_at')->latest('id');
    }

    /** Uma linha como a página a mostra: frase, grupo, o que mudou, IP e browser. */
    private function activityRow(ActivityLog $a): array
    {
        [$group, $verb, $alert] = Activity::ACTIONS[$a->action] + [null, null, false];
        $at = $a->created_at;

        return [
            'id' => $a->id,
            'time' => $at->format('H:i'),
            'day' => $at->isToday() ? __('Hoje') : ($at->isYesterday() ? __('Ontem') : $at->translatedFormat('j M Y')),
            'when' => $at->isoFormat('LL, HH:mm:ss'),
            'ago' => $at->diffForHumans(),
            'who' => $a->user_id || $a->user_name ? ['id' => $a->user_id, 'name' => $a->user_name ?? __('Conta apagada'), 'role' => $a->role] : null,
            'related' => $a->relatedUser ? ['id' => $a->relatedUser->id, 'name' => $a->relatedUser->name, 'role' => $a->relatedUser->role?->name] : null,
            'action' => $a->action,
            'group' => $group ? __(Activity::GROUPS[$group]) : null,
            'verb' => $verb ? __($verb) : $a->action,
            'alert' => (bool) $alert,
            'subject' => $a->subject_label ? ['type' => $a->subject_type, 'label' => $a->subject_label] : null,
            'props' => $a->properties,
            'ip' => $a->ip,
            'ua' => $a->user_agent,
            'keptLonger' => collect(Activity::KEEP_LONGER)->contains(fn ($p) => str_starts_with($a->action, $p)),
        ];
    }

    private function activity(Request $request): array
    {
        $f = $this->activityFilters($request);
        $rows = $this->activityQuery($f)->paginate(50)->withQueryString();

        // A vigiar: 3 ou mais entradas falhadas do mesmo IP na última hora
        $hot = ActivityLog::where('action', 'conta.entrada_falhou')->where('created_at', '>=', now()->subHour())
            ->whereNotNull('ip')->selectRaw('ip, count(*) as n')->groupBy('ip')->havingRaw('count(*) >= 3')->orderByDesc('n')->first();
        $watch = $hot ? [
            'ip' => $hot->ip,
            'n' => (int) $hot->n,
            'emails' => ActivityLog::where('action', 'conta.entrada_falhou')->where('ip', $hot->ip)->where('created_at', '>=', now()->subHour())
                ->get(['properties'])->pluck('properties.email')->filter()->unique()->values(),
        ] : null;

        return [
            'rows' => $rows->through(fn (ActivityLog $a) => $this->activityRow($a)),
            'filters' => $f,
            'person' => $f['pessoa'] ? User::withTrashed()->find($f['pessoa'], ['id', 'name'])?->only(['id', 'name']) : null,
            'groups' => collect(Activity::GROUPS)->map(fn ($label, $key) => ['key' => $key, 'label' => __($label)])->values(),
            'periods' => self::LOG_PERIODS,
            'watch' => $watch,
        ];
    }

    /** Exporta para Excel (CSV com ;) as linhas com os mesmos filtros da página, até 10 000. */
    public function exportActivity(Request $request): StreamedResponse
    {
        abort_unless($request->user()->isAdmin(), 403);
        $f = $this->activityFilters($request);
        Activity::log('registo.exportado', null, array_filter($f));

        return response()->streamDownload(function () use ($f) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\u{FEFF}");
            fputcsv($out, [__('Data'), __('Hora'), __('Quem'), __('Perfil'), __('Ação'), __('Grupo'), __('Sobre'), __('Afetado'), __('Detalhe'), 'IP', __('Browser')], ';');
            $this->activityQuery($f)->limit(10000)->get()->each(function (ActivityLog $a) use ($out) {
                $r = $this->activityRow($a);
                fputcsv($out, [
                    $a->created_at->format('Y-m-d'), $a->created_at->format('H:i:s'), $r['who']['name'] ?? __('Sem sessão'), $r['who']['role'] ?? '',
                    $r['verb'], $r['group'], $r['subject']['label'] ?? '', $r['related']['name'] ?? '',
                    $a->properties ? json_encode($a->properties, JSON_UNESCAPED_UNICODE) : '', $a->ip, $a->user_agent,
                ], ';');
            });
            fclose($out);
        }, 'registo-atividade-'.now()->format('Y-m-d').'.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }
}
