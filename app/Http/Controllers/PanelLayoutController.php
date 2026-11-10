<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** Guarda a disposição das caixas de cada utilizador, por página. */
class PanelLayoutController extends Controller
{
    private const VIEWS = ['home', 'cursos', 'curso', 'avaliacoes', 'documentos', 'equipas', 'formador'];

    private const MAX_PANELS = 12;

    public function update(Request $request, string $view): Response
    {
        abort_unless(in_array($view, self::VIEWS, true), 404);

        $data = $request->validate([
            'items' => ['required', 'array', 'max:'.self::MAX_PANELS],
            'items.*.x' => ['required', 'integer', 'between:0,23'],
            'items.*.y' => ['required', 'integer', 'between:0,500'],
            'items.*.w' => ['required', 'integer', 'between:1,24'],
            'items.*.h' => ['required', 'integer', 'between:1,60'],
            'collapsed' => ['present', 'array', 'max:'.self::MAX_PANELS],
            'collapsed.*' => ['string', 'max:30'],
            'hidden' => ['present', 'array', 'max:'.self::MAX_PANELS],
            'hidden.*' => ['string', 'max:30'],
            'order' => ['present', 'array', 'max:'.self::MAX_PANELS],
            'order.*' => ['string', 'max:30'],
        ]);
        foreach (array_keys($data['items']) as $id) {
            if (! preg_match('/^[a-z]{1,30}$/', (string) $id)) {
                throw ValidationException::withMessages(['items' => __('Painel inválido.')]);
            }
        }

        $user = $request->user();
        $layouts = $user->panel_layouts ?? [];
        $layouts[$view] = $data;
        $user->forceFill(['panel_layouts' => $layouts])->save();

        return response()->noContent();
    }

    public function destroy(Request $request, string $view): Response
    {
        abort_unless(in_array($view, self::VIEWS, true), 404);

        $user = $request->user();
        $layouts = $user->panel_layouts ?? [];
        unset($layouts[$view]);
        $user->forceFill(['panel_layouts' => $layouts ?: null])->save();

        return response()->noContent();
    }
}
