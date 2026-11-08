<?php

namespace App\Http\Controllers;

use App\Models\Course;
use App\Models\CourseView;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Clique num curso do catálogo (abre o detalhe do curso). Conta para as estatísticas da Administração.
 * A mesma pessoa no mesmo curso conta uma vez por cada 30 minutos; quem cria o curso não conta.
 */
class CourseViewController extends Controller
{
    public function __invoke(Request $request, Course $course): Response
    {
        $user = $request->user();
        abort_unless($course->status === 'published', 404);

        $recent = CourseView::where('course_id', $course->id)->where('user_id', $user->id)
            ->where('created_at', '>=', now()->subMinutes(30))->exists();
        if (! $recent && $course->instructor_id !== $user->id) {
            CourseView::create(['course_id' => $course->id, 'user_id' => $user->id]);
        }

        return response()->noContent();
    }
}
