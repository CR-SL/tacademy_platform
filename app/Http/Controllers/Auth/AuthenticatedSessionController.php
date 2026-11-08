<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Illuminate\Support\Facades\Route;
use Inertia\Response;

class AuthenticatedSessionController extends Controller
{
    /**
     * Entrada da plataforma (/ e /login): intro do pássaro na primeira visita e o separador Entrar.
     */
    public function create(Request $request): Response
    {
        return Inertia::render('Auth/Entrada', [
            'mode' => 'entrar',
            'status' => session('status'),
            'canResetPassword' => Route::has('password.request'),
        ]);
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

        // Depois de sair, volta à entrada com uma confirmação (sem repetir a intro)
        return redirect()->route('login')->with('status', __('Sessão terminada. Até breve.'));
    }
}
