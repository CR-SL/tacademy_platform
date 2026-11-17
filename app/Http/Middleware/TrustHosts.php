<?php

namespace App\Http\Middleware;

use Illuminate\Http\Middleware\TrustHosts as Base;
use Illuminate\Http\Request;

/**
 * Só aceita pedidos com o domínio do APP_URL (e os seus subdomínios). Sem isto, quem faz o pedido
 * escolhia o domínio dos links dos emails (ex.: "esqueci-me a palavra-passe") com X-Forwarded-Host.
 * O teste de saúde (/up) fica de fora: o Railway chama-o com um domínio seu (healthcheck.railway.app).
 * Em local e nos testes não faz nada (regra do Laravel).
 */
class TrustHosts extends Base
{
    public function handle(Request $request, $next)
    {
        if ($request->path() === 'up') {
            return $next($request);
        }

        return parent::handle($request, $next);
    }
}
