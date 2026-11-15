<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Guarda em users.last_active_at a última vez que a pessoa usou a plataforma (no máximo uma escrita a cada
 * 5 minutos). É daqui que vêm "Ainda não entrou" / "nunca entrou" (team leader, gestão, administração) e a
 * escolha entre "Definir palavra-passe" e o link do curso nos lembretes.
 */
class TouchLastActive
{
    private const EVERY_MINUTES = 5;

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if ($user && (! $user->last_active_at || $user->last_active_at->lt(now()->subMinutes(self::EVERY_MINUTES)))) {
            $now = now();
            // Escrita direta: sem eventos do modelo (não é uma alteração da conta) e sem mexer em updated_at
            $user->newQuery()->whereKey($user->getKey())->toBase()->update(['last_active_at' => $now]);
            $user->setAttribute('last_active_at', $now)->syncOriginalAttribute('last_active_at');
        }

        return $next($request);
    }
}
