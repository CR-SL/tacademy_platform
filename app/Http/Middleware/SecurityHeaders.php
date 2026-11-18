<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Vite;
use Symfony\Component\HttpFoundation\Response;

/**
 * Cabeçalhos de segurança em todas as respostas da app (auditoria, ponto 9).
 *
 * - Clickjacking: nenhum outro site pode mostrar a plataforma dentro de um iframe (frame-ancestors / X-Frame-Options).
 *   A própria plataforma pode (o leitor de PDF da aula mostra o anexo num iframe).
 * - nosniff, Referrer-Policy e, em HTTPS, HSTS.
 * - CSP em duas partes:
 *   - sempre aplicada: o que não pode partir nada (base-uri, object-src, frame-ancestors) e os sites que podem
 *     aparecer em iframes (vídeos do YouTube e Vimeo, avatar do Tavus);
 *   - a completa (scripts com nonce, ligações, imagens…): só reporta para /csp-report até CSP_ENFORCE=true.
 *     Assim vê-se no registo se alguma coisa (o Alex, o leitor de vídeo) ficaria bloqueada antes de a ligar.
 */
class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        // O nonce entra nas tags do Vite e nos scripts da página (app.blade.php)
        Vite::useCspNonce();

        $response = $next($request);
        $h = $response->headers;

        $h->set('X-Frame-Options', 'SAMEORIGIN');
        $h->set('X-Content-Type-Options', 'nosniff');
        $h->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        $h->set('Permissions-Policy', 'geolocation=(), payment=(), usb=(), interest-cohort=()');
        if ($request->isSecure()) {
            $h->set('Strict-Transport-Security', 'max-age=31536000');
        }

        // A CSP é para as páginas. Num PDF ou vídeo, o object-src 'none' impedia o leitor de PDF do browser de o mostrar.
        if (! str_contains((string) $h->get('Content-Type'), 'text/html')) {
            return $response;
        }

        $base = self::basePolicy();
        $full = self::fullPolicy(Vite::cspNonce());
        if (config('tacademy.csp_enforce')) {
            $h->set('Content-Security-Policy', $full);
        } else {
            $h->set('Content-Security-Policy', $base);
            $h->set('Content-Security-Policy-Report-Only', $full);
        }

        return $response;
    }

    /** Sites que podem aparecer em iframes: a própria plataforma (PDF), YouTube, Vimeo e os do avatar. */
    private static function frameSources(): string
    {
        $avatar = collect(config('tacademy.avatar_hosts', []))->flatMap(fn ($h) => ["https://$h", "https://*.$h"])->implode(' ');

        return trim("'self' blob: https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com $avatar");
    }

    public static function basePolicy(): string
    {
        return implode('; ', [
            "base-uri 'self'",
            "object-src 'none'",
            "frame-ancestors 'self'",
            'frame-src '.self::frameSources(),
        ]);
    }

    public static function fullPolicy(string $nonce): string
    {
        return implode('; ', [
            "default-src 'self'",
            "base-uri 'self'",
            "object-src 'none'",
            "frame-ancestors 'self'",
            'frame-src '.self::frameSources(),
            // strict-dynamic: os scripts carregados pelos da página (API do YouTube e do Vimeo, Daily do Alex) também passam
            "script-src 'nonce-$nonce' 'strict-dynamic' 'wasm-unsafe-eval' 'self' https:",
            // Estilos inline: o React usa o atributo style
            "style-src 'self' 'unsafe-inline'",
            "font-src 'self' data:",
            "img-src 'self' data: blob: https:",
            "media-src 'self' blob: https:",
            "connect-src 'self' https: wss:",
            "worker-src 'self' blob:",
            "form-action 'self'",
            'report-uri /csp-report',
        ]);
    }
}
