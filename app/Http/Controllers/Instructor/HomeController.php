<?php

namespace App\Http\Controllers\Instructor;

use App\Http\Controllers\Controller;
use App\Services\InstructorArea;
use App\Services\StudentArea;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Início e Avaliações do formador (opção D da navegação): os seus cursos, as notas dos seus alunos e as mensagens. */
class HomeController extends Controller
{
    public function __construct(private InstructorArea $area) {}

    public function home(Request $request, StudentArea $student): Response
    {
        $user = $request->user();
        $rows = $this->area->assessments($user);

        return Inertia::render('Instructor/Home', [
            'courses' => $this->area->courses($user),
            // Primeiro quem ainda não passou, depois os mais recentes
            'assessments' => $rows->sortBy(fn ($r) => $r['passed'] ? 1 : 0)->take(6)->values(),
            'attention' => $rows->where('passed', false)->count(),
            'messages' => $student->messages($user),
            'savedLayout' => $student->layout($user, 'formador'),
        ]);
    }

    public function assessments(Request $request): Response
    {
        $rows = $this->area->assessments($request->user());

        return Inertia::render('Instructor/Assessments', [
            'rows' => $rows,
            'byCourse' => $this->area->byCourse($rows),
        ]);
    }
}
