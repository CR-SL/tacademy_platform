<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\ContactRequest;
use App\Models\Course;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Catálogo da plataforma (/plataforma/cursos): aberto a quem ainda não tem conta.
 * Comprar pede sessão (o botão leva a entrar e volta ao curso).
 */
class CatalogController extends Controller
{
    public function __invoke(Request $request): Response|RedirectResponse
    {
        // "Entrar para comprar" sem sessão: depois de entrar (ou criar conta) volta ao curso aberto
        if (! $request->user() && $request->boolean('entrar')) {
            $slug = (string) $request->query('curso', '');
            $request->session()->put('url.intended', route('catalog', $slug !== '' ? ['curso' => $slug] : []));

            return redirect()->route($request->query('conta') === 'nova' ? 'register' : 'login');
        }

        return Inertia::render('Catalog', self::catalog());
    }

    /** Cursos publicados, áreas e, com sessão, os cursos que a pessoa já tem ou aguardam autorização. */
    public static function catalog(): array
    {
        $courses = Course::with([
            'category',
            'instructor',
            'modules' => fn ($q) => $q->orderBy('order_index')->with(['lessons' => fn ($l) => $l->orderBy('order_index')]),
        ])
            ->where('status', 'published')
            ->orderBy('title')
            ->get();

        $images = config('tacademy.course_images');
        $fallback = config('tacademy.course_image_fallback');

        $items = $courses->map(function (Course $c) use ($images, $fallback) {
            $lessons = $c->modules->flatMap->lessons;

            return [
                'id' => $c->id,
                'slug' => $c->slug,
                'title' => $c->title,
                'area' => $c->category?->slug,
                'areaName' => $c->category?->name,
                'level' => Course::LEVELS[$c->level] ?? $c->level,
                'minutes' => (int) $c->duration_minutes,
                'price' => (float) $c->price,
                'description' => $c->description,
                'image' => $c->thumbnail_url ?: ($images[$c->slug] ?? $fallback),
                'ai' => $lessons->contains('content_type', 'avatar'),
                'lessons' => $lessons->count(),
                'modules' => $c->modules->map(fn ($m) => [
                    'title' => $m->title,
                    'lessons' => $m->lessons->map(fn ($l) => [
                        'title' => $l->title,
                        'ai' => $l->content_type === 'avatar',
                        'minutes' => (int) round($l->duration_seconds / 60),
                    ])->values(),
                ])->values(),
                'instructor' => $c->instructor?->name,
            ];
        })->values();

        $areas = Category::whereIn('id', $courses->pluck('category_id')->unique())
            ->orderBy('name')
            ->get(['slug', 'name']);

        // Quem tem sessão: que cursos já tem e que compras aguardam autorização
        $user = request()->user();
        $owned = $user ? $user->enrollments()->pluck('course_id') : collect();
        $pending = $user
            ? ContactRequest::where('user_id', $user->id)->where('kind', 'compra')->whereIn('status', ContactRequest::OPEN)->pluck('course_id')
            : collect();

        return [
            'courses' => $items,
            'areas' => $areas,
            'owned' => $owned->values(),
            'pending' => $pending->filter()->values(),
        ];
    }
}
