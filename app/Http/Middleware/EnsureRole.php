<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Só deixa passar os perfis indicados, ex.: `role:gestor_cursos,admin`. */
class EnsureRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        abort_unless(in_array($request->user()?->role?->name, $roles, true), 403);

        return $next($request);
    }
}
