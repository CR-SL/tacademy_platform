<?php

namespace App\Http\Middleware;

use App\Models\ContactRequest;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that is loaded on the first page visit.
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determine the current asset version.
     */
    public function version(Request $request): ?string
    {
        // A versão muda a cada build (o manifest do Vite muda). O Inertia, de origem, usa o ASSET_URL quando existe, e
        // no Railway esse valor é sempre o mesmo: uma página aberta antes de um deploy pedia ficheiros que já não
        // existem e mostrava a página de erro até ao refresh. Com o manifest, o Inertia recarrega a página sozinho.
        if (is_file($manifest = public_path('build/manifest.json'))) {
            return hash_file('xxh128', $manifest);
        }

        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'auth' => [
                // Só os campos que a interface usa (antes ia a conta inteira: créditos, empresa, restos de XP…)
                'user' => $request->user()?->only(['id', 'ulid', 'name', 'email', 'email_verified_at', 'theme', 'email_reminders']),
                // Perfil (aluno, formador, team_leader, gestor_cursos, admin): mostra "Os meus cursos" na navbar
                'role' => $request->user()?->role?->name,
                // Formador, gestor de cursos e admin: só o seu trabalho na barra (opção D)
                'worksOnly' => (bool) $request->user()?->worksOnly(),
                'home' => $request->user()?->homeUrl() ?? '/',
            ],
            // O que a pessoa pode fazer (menu e botões); o servidor volta sempre a verificar
            'can' => fn () => $request->user()
                ? collect(\App\Support\Permissions::keys())->mapWithKeys(fn ($p) => [$p => $request->user()->canDo($p)])
                : [],
            // Língua da plataforma (pt | en); as traduções estão em lang/en.json
            'locale' => fn () => app()->getLocale(),
            'flash' => [
                'status' => fn () => $request->session()->get('status'),
            ],
            // Números da navegação (o que pede ação): mensagens por ler, cursos atribuídos por começar, equipa, presenças
            'navCounts' => fn () => $request->user() ? app(\App\Services\Tasks::class)->navCounts($request->user()) : [],
            // O Alex (Tavus): onde pode ser chamado nesta página e quantas conversas faltam hoje; null onde não aparece
            'alex' => fn () => app(\App\Services\AlexService::class)->forRequest($request),
            // Tamanho da caixa do avatar: um só para todas as páginas de cada utilizador (2026-11-28); null = o inicial
            'avatarBox' => fn () => $request->user()?->panel_layouts['avatar'] ?? null,
            // Sino do Gestor de Cursos/admin: pedidos novos
            'staffInbox' => fn () => $request->user()?->isCourseStaff()
                ? [
                    'count' => ContactRequest::where('status', 'novo')->count(),
                    'items' => ContactRequest::where('status', 'novo')->latest()->limit(6)->get()->map(fn ($r) => [
                        'id' => $r->id,
                        'kind' => __(ContactRequest::KINDS[$r->kind] ?? $r->kind),
                        'who' => $r->company ?: $r->name,
                        'ago' => $r->created_at?->diffForHumans(),
                    ]),
                ]
                : null,
        ];
    }
}
