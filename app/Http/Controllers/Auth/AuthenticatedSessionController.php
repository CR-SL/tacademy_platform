<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

class AuthenticatedSessionController extends Controller
{
    /**
     * Já não há página de login: o login faz-se na caixa do botão "Entrar" da landing.
     * /login continua a existir (logout, sessão expirada, links antigos) e leva à landing; a caixa começa fechada.
     */
    public function create(Request $request): SymfonyResponse
    {
        // Mantém mensagens e erros (ex.: "Sessão terminada", palavra-passe reposta) para o pedido seguinte
        $request->session()->reflash();

        // Inertia::location força uma navegação completa (a landing é Blade, não Inertia)
        return Inertia::location(route('home'));
    }

    /**
     * Handle an incoming authentication request.
     */
    public function store(LoginRequest $request): RedirectResponse
    {
        $request->authenticate();

        $request->session()->regenerate();

        return redirect()->intended(route('dashboard', absolute: false));
    }

    /**
     * Destroy an authenticated session.
     */
    public function destroy(Request $request): RedirectResponse
    {
        Auth::guard('web')->logout();

        $request->session()->invalidate();

        $request->session()->regenerateToken();

        // Depois de sair, volta ao login (página Inertia) com uma confirmação
        // login_open: só depois do logout é que a caixa de login da landing aparece já aberta
        return redirect()->route('login')
            ->with('status', 'Sessão terminada. Até breve!')
            ->with('login_open', true);
    }
}
