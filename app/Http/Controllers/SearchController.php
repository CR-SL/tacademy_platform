<?php

namespace App\Http\Controllers;

use App\Services\PlatformSearch;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Lupa do topo: procura só em categorias e cursos (2026-11-24). */
class SearchController extends Controller
{
    public function __invoke(Request $request, PlatformSearch $search): JsonResponse
    {
        $data = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
        ]);

        return response()->json($search->search($request->user(), (string) ($data['q'] ?? '')));
    }
}
