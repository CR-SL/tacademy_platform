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
                'user' => $request->user(),
                // Perfil (aluno, formador, team_leader, gestor_cursos, admin): mostra "Os meus cursos" na navbar
                'role' => $request->user()?->role?->name,
            ],
            'flash' => [
                'status' => fn () => $request->session()->get('status'),
            ],
            // Sino do Gestor de Cursos/admin: pedidos novos
            'staffInbox' => fn () => $request->user()?->isCourseStaff()
                ? [
                    'count' => ContactRequest::where('status', 'novo')->count(),
                    'items' => ContactRequest::where('status', 'novo')->latest()->limit(6)->get()->map(fn ($r) => [
                        'id' => $r->id,
                        'kind' => ContactRequest::KINDS[$r->kind] ?? $r->kind,
                        'who' => $r->company ?: $r->name,
                        'ago' => $r->created_at?->diffForHumans(),
                    ]),
                ]
                : null,
        ];
    }
}
