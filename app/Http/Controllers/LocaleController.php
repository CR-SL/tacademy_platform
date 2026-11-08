<?php

namespace App\Http\Controllers;

use App\Http\Middleware\SetLocale;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Botão PT · EN e Definições: guarda a língua na conta (e neste browser, para antes de entrar). */
class LocaleController extends Controller
{
    public function __invoke(Request $request): RedirectResponse
    {
        $data = $request->validate(['locale' => ['required', Rule::in(SetLocale::LOCALES)]]);
        $request->user()?->forceFill(['locale' => $data['locale']])->save();

        return back()->withCookie(cookie()->forever(SetLocale::COOKIE, $data['locale']));
    }
}
