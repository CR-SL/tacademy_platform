<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Course;
use App\Models\Lesson;
use Illuminate\Contracts\View\View;

/**
 * Landing page pública (Blade, indexável) — conceito A "As Peças".
 */
class LandingController extends Controller
{
    public function __invoke(): View
    {
        // Secção "Cursos": uma fotografia por área, com o n.º de cursos publicados
        $images = config('tacademy.area_images');
        $areas = Category::withCount(['courses' => fn ($q) => $q->where('status', 'published')])
            ->orderBy('name')
            ->get()
            ->filter(fn (Category $c) => $c->courses_count > 0)
            ->map(fn (Category $c) => [
                'slug' => $c->slug,
                'name' => $c->name,
                'count' => $c->courses_count,
                'image' => $images[$c->slug] ?? config('tacademy.course_image_fallback'),
            ]);

        return view('landing', [
            'areas' => $areas,
            'stats' => [
                'courses' => Course::where('status', 'published')->count(),
                'areas' => Category::whereHas('courses', fn ($q) => $q->where('status', 'published'))->count(),
                'lessons' => Lesson::whereHas('module.course', fn ($q) => $q->where('status', 'published'))->count(),
            ],
        ]);
    }
}
