<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\App;
use Symfony\Component\HttpFoundation\Response;

/**
 * Língua da plataforma: a da conta; sem sessão, a escolhida neste browser (cookie);
 * senão, a do browser quando é inglês; senão, português.
 * O conteúdo dos cursos não muda: fica na língua em que o formador o escreveu.
 */
class SetLocale
{
    public const LOCALES = ['pt', 'en'];

    public const COOKIE = 'lang';

    public function handle(Request $request, Closure $next): Response
    {
        self::apply(self::pick($request));

        return $next($request);
    }

    /** Muda a língua da aplicação e das datas (Carbon) ao mesmo tempo. */
    public static function apply(?string $locale): void
    {
        $locale = in_array($locale, self::LOCALES, true) ? $locale : config('app.locale', 'pt');
        App::setLocale($locale);
        // Os textos estão escritos em português: sem tradução, fica o original (nunca o inglês por engano)
        app('translator')->setFallback('pt');
        Carbon::setLocale($locale === 'pt' ? 'pt_PT' : 'en');
    }

    public static function pick(Request $request): string
    {
        $user = $request->user();
        if (in_array($user?->locale, self::LOCALES, true)) {
            return $user->locale;
        }
        $cookie = $request->cookie(self::COOKIE);
        if (in_array($cookie, self::LOCALES, true)) {
            // Escolheu no botão antes de entrar: a conta passa a guardar essa língua (também para os emails)
            $user?->forceFill(['locale' => $cookie])->save();

            return $cookie;
        }

        // Língua do browser: muita gente em Portugal tem o browser ou o telemóvel em inglês, por isso
        // basta o português aparecer na lista para ficar em português; inglês só quando não há português.
        $langs = array_map(fn ($l) => substr(strtolower($l), 0, 2), $request->getLanguages());
        if (in_array('pt', $langs, true)) {
            return 'pt';
        }
        if (in_array('en', $langs, true)) {
            return 'en';
        }

        return config('app.locale', 'pt');
    }
}
