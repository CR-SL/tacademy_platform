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
        $courses = Course::with('category')
            ->where('status', 'published')
            ->withCount(['lessons as ai_count' => fn ($q) => $q->where('content_type', 'avatar')])
            ->withCount('enrollments')
            ->orderByDesc('enrollments_count')
            ->latest()
            ->take(8)
            ->get();

        return view('landing', [
            'courses' => $courses,
            'stats' => [
                'courses' => Course::where('status', 'published')->count(),
                'areas' => Category::whereHas('courses', fn ($q) => $q->where('status', 'published'))->count(),
                'lessons' => Lesson::whereHas('module.course', fn ($q) => $q->where('status', 'published'))->count(),
            ],
            'contact' => config('tacademy.contact'),
        ]);
    }
}
