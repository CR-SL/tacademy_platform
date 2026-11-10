<?php

namespace App\Services;

use App\Models\Company;
use App\Models\ContactRequest;
use App\Models\Course;
use App\Models\Role;
use App\Models\User;

/**
 * Caixas de trabalho do Início (2026-11-10). O Início é uma só página para todos: cada caixa só
 * existe para quem tem a permissão dela, e só se calculam os dados das caixas que a pessoa pode ver.
 * As caixas de aprender vêm do StudentArea. Só dados reais.
 */
class WorkArea
{
    public function __construct(
        private AdminStats $stats,
        private InstructorArea $instructor,
        private TeamService $teams,
    ) {}

    /** Os dados de cada caixa que a pessoa pode ver (as chaves são as caixas). */
    public function panels(User $user): array
    {
        $can = fn (string $p) => $user->canDo($p);
        $out = [];

        if ($can('estatisticas')) {
            $out['overview'] = $this->stats->overview();
            $out['attention'] = $this->stats->attention();
            $views = $this->stats->viewsByCourse()->sortDesc()->take(5);
            $titles = Course::whereIn('id', $views->keys())->pluck('title', 'id');
            $out['views'] = $views->map(fn ($n, $id) => ['title' => $titles[$id] ?? '', 'n' => $n])->values();
        }
        if ($can('pessoas')) {
            $out['people'] = $this->people();
        }
        if ($can('pedidos')) {
            $out['requests'] = ContactRequest::with('course:id,title')->where('status', 'novo')->latest()->limit(6)->get()
                ->map(fn ($r) => [
                    'id' => $r->id,
                    'kind' => __(ContactRequest::KINDS[$r->kind] ?? $r->kind),
                    'who' => $r->company ?: $r->name,
                    'course' => $r->course?->title,
                    'ago' => $r->created_at?->diffForHumans(),
                ]);
            $out['purchases'] = ContactRequest::with('course:id,title')->where('kind', 'compra')->where('type', 'particular')
                ->where('status', 'pago')->oldest()->limit(6)->get()
                ->map(fn ($r) => [
                    'id' => $r->id,
                    'who' => $r->name,
                    'course' => $r->course?->title,
                    'ago' => $r->created_at?->diffForHumans(),
                ]);
        }
        if ($can('equipas')) {
            $out['teams'] = Company::withCount('users')->orderBy('name')->limit(8)->get()->map(fn (Company $c) => [
                'ulid' => $c->ulid,
                'name' => $c->name,
                'members' => $c->users_count,
                'seats' => $c->seats(),
                'late' => collect($this->teams->report($c)['members'])
                    ->filter(fn ($m) => collect($m['courses'])->contains(fn ($s) => $s['late']))->count(),
            ]);
        }
        if ($can('cursos.todos')) {
            $out['catalog'] = [
                'published' => Course::where('status', 'published')->count(),
                'drafts' => Course::where('status', '!=', 'published')->count(),
                'recent' => Course::with('instructor:id,name')->latest('updated_at')->limit(5)->get()->map(fn (Course $c) => [
                    'ulid' => $c->ulid,
                    'title' => $c->title ?: __('Curso sem título'),
                    'instructor' => $c->instructor?->name,
                    'status' => $c->status,
                    'when' => $c->updated_at?->diffForHumans(),
                ]),
            ];
        }
        if ($can('cursos.criar')) {
            $rows = $this->instructor->assessments($user);
            $out['teaching'] = $this->instructor->courses($user);
            // Primeiro quem ainda não passou, depois os mais recentes
            $out['assessments'] = $rows->sortBy(fn ($r) => $r['passed'] ? 1 : 0)->take(6)->values();
            $out['failing'] = $rows->where('passed', false)->count();
        }
        // Team leader: quem da equipa da sua empresa precisa de atenção
        if ($can('equipa') && $user->company) {
            $out['team'] = $this->team($user->company);
        }

        return $out;
    }

    /** Tarefas de trabalho para a caixa Pendentes (as de aprender, mensagens e presenças vêm do Tasks). */
    public function tasks(User $user): array
    {
        $list = [];

        if ($user->canDo('pedidos')) {
            $paid = ContactRequest::where('kind', 'compra')->where('type', 'particular')->where('status', 'pago')->count();
            if ($paid) {
                $list[] = [
                    'kind' => 'Compra',
                    'title' => trans_choice('{1} 1 compra paga por autorizar|[2,*] :count compras pagas por autorizar', $paid),
                    'course' => __('Pedidos'),
                    'text' => __('Os alunos só têm acesso ao curso depois de autorizares.'),
                    'cta' => __('Ver os pedidos'),
                    'url' => '/gestao/pedidos',
                ];
            }
            $new = ContactRequest::where('status', 'novo')->where('created_at', '<=', now()->subDay())->count();
            if ($new) {
                $list[] = [
                    'kind' => 'Pedido',
                    'title' => trans_choice('{1} 1 pedido sem resposta há mais de um dia|[2,*] :count pedidos sem resposta há mais de um dia', $new),
                    'course' => __('Pedidos'),
                    'text' => __('Quem pediu contacto ainda está à espera.'),
                    'cta' => __('Ver os pedidos'),
                    'url' => '/gestao/pedidos',
                ];
            }
        }
        if ($user->canDo('cursos.todos')) {
            $drafts = Course::where('status', '!=', 'published')->where('instructor_id', '!=', $user->id)->count();
            if ($drafts) {
                $list[] = [
                    'kind' => 'Cursos',
                    'title' => trans_choice('{1} 1 curso em rascunho de um formador|[2,*] :count cursos em rascunho de formadores', $drafts),
                    'course' => __('Gerir cursos'),
                    'text' => __('Ainda não estão no catálogo.'),
                    'cta' => __('Ver os cursos'),
                    'url' => '/formador/cursos',
                ];
            }
        }

        return $list;
    }

    /** Equipa do team leader: quantas pessoas são e quem precisa de atenção (a regra da página da equipa). */
    private function team(Company $company): array
    {
        // A mesma regra dos Pendentes e da página da equipa: sem entrar, fora do prazo ou parado
        $members = collect($this->teams->report($company)['members']);
        $flag = function ($m) {
            $c = collect($m['courses']);

            return match (true) {
                $m['invited'] => __('Ainda não entrou'),
                $c->contains(fn ($s) => $s['late']) => __('Fora do prazo'),
                $c->contains(fn ($s) => $s['stalled']) => __('Parado há mais de 10 dias'),
                default => null,
            };
        };

        $attention = $members->map(fn ($m) => ['name' => $m['name'], 'why' => $flag($m)])->filter(fn ($m) => $m['why'])->values();

        return [
            'name' => $company->name,
            'members' => $members->count(),
            'seats' => $company->seats(),
            'count' => $attention->count(),
            'attention' => $attention->take(8),
        ];
    }

    /** Pessoas: contas novas, quem nunca entrou e quantas pessoas há em cada perfil. */
    private function people(): array
    {
        $roles = Role::withCount('users')->get()->pluck('users_count', 'name');

        return [
            'week' => User::where('created_at', '>=', now()->subWeek())->count(),
            'never' => User::whereNull('last_active_at')->where('created_at', '<=', now()->subDays(7))->count(),
            'roles' => collect(\App\Support\Permissions::ROLES)
                ->map(fn ($r, $key) => ['name' => __($r[0]), 'n' => (int) ($roles[$key] ?? 0)])
                ->filter(fn ($r) => $r['n'] > 0)->values(),
        ];
    }
}
