<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->web(append: [
            \App\Http\Middleware\SetLocale::class,
            \App\Http\Middleware\TouchLastActive::class,
            \App\Http\Middleware\HandleInertiaRequests::class,
            \Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets::class,
        ]);

        // A língua escolhida antes de entrar fica num cookie simples (não precisa de ser cifrado)
        $middleware->encryptCookies(except: ['lang']);

        // Os avisos do Tavus chegam sem sessão: a assinatura X-Tavus-Signature substitui o CSRF
        $middleware->validateCsrfTokens(except: ['webhooks/tavus']);

        // Os proxies em que se confia (HTTPS e IP real do visitante) vêm de config/trustedproxy.php (TRUSTED_PROXIES).

        // Só se aceitam pedidos com o domínio do APP_URL (links dos emails não podem ser desviados)
        $middleware->trustHosts();
        $middleware->replace(\Illuminate\Http\Middleware\TrustHosts::class, \App\Http\Middleware\TrustHosts::class);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Limite de pedidos atingido num formulário (registo, "esqueci-me"): volta ao formulário com um aviso,
        // em vez da página de erro 429. Pedidos JSON continuam a receber o 429.
        $exceptions->render(function (\Illuminate\Http\Exceptions\ThrottleRequestsException $e, \Illuminate\Http\Request $request) {
            if ($request->expectsJson() || $request->isMethod('GET')) {
                return null;
            }
            $minutes = (int) ceil(((int) ($e->getHeaders()['Retry-After'] ?? 60)) / 60);

            return back()->withInput($request->except('password', 'password_confirmation'))
                ->withErrors(['email' => trans_choice('Demasiadas tentativas. Tenta outra vez daqui a 1 minuto.|Demasiadas tentativas. Tenta outra vez daqui a :count minutos.', $minutes)]);
        });

        // Página 404 da plataforma (Pages/Error.jsx) para quem navega; pedidos JSON e de ficheiros
        // (imagens, scripts) continuam com a resposta simples. Endereços que não existem não passam
        // pelas rotas, por isso a língua vem da conta, do cookie ou do browser (SetLocale::pick).
        $exceptions->respond(function (\Symfony\Component\HttpFoundation\Response $response, \Throwable $e, \Illuminate\Http\Request $request) {
            $wantsPage = ! $request->expectsJson()
                && ($request->header('X-Inertia') || str_contains((string) $request->header('Accept'), 'text/html'));
            if ($response->getStatusCode() !== 404 || ! $wantsPage) {
                return $response;
            }
            \App\Http\Middleware\SetLocale::apply(\App\Http\Middleware\SetLocale::pick($request));

            return \Inertia\Inertia::render('Error', ['status' => 404, 'locale' => app()->getLocale()])
                ->toResponse($request)
                ->setStatusCode(404);
        });
    })->create();
