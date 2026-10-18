<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\ContactRequest;
use App\Models\Course;
use Illuminate\Contracts\View\View;

/**
 * Catálogo público de cursos (/cursos, Blade) — versão "como o artifact" (exemplo 4):
 * cartões com fotografia, separadores por área, pesquisa e aba lateral com o detalhe e o programa.
 */
class PublicCourseController extends Controller
{
    private const LEVELS = ['iniciante' => 'Iniciante', 'intermedio' => 'Intermédio', 'avancado' => 'Avançado'];

    public function __invoke(): View
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
                'level' => self::LEVELS[$c->level] ?? $c->level,
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

        return view('cursos', [
            'courses' => $items,
            'areas' => $areas,
            'owned' => $owned->values(),
            'pending' => $pending->filter()->values(),
        ]);
    }
}
