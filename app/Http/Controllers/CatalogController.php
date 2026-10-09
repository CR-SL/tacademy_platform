<?php

namespace App\Http\Controllers;

use App\Models\Category;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CatalogController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $categories = Category::query()
            ->whereHas('courses', fn ($q) => $q->where('status', 'published'))
            ->with(['courses' => fn ($q) => $q->where('status', 'published')->latest()])
            ->orderBy('name')
            ->get()
            ->map(fn (Category $category) => [
                'id' => $category->id,
                'name' => $category->name,
                'color_hex' => $category->color_hex,
                'courses' => $category->courses->map(fn ($course) => [
                    'id' => $course->id,
                    'title' => $course->title,
                    'level' => $course->level,
                    'duration_minutes' => $course->duration_minutes,
                    'price' => (float) $course->price,
                    'url' => '/cursos/'.$course->ulid,
                    'has_ai' => $course->lessons()->where('content_type', 'avatar')->exists(),
                    'category' => ['color_hex' => $category->color_hex],
                ]),
            ]);

        return Inertia::render('Catalog', [
            'categories' => $categories,
        ]);
    }
}
