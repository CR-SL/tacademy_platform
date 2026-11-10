<?php

namespace App\Http\Controllers\Instructor;

use App\Http\Controllers\Controller;
use App\Services\InstructorArea;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Avaliações do formador: as notas dos seus alunos. O Início passou para o Início de trabalho (WorkArea). */
class HomeController extends Controller
{
    public function __construct(private InstructorArea $area) {}

    public function assessments(Request $request): Response
    {
        $rows = $this->area->assessments($request->user());

        return Inertia::render('Instructor/Assessments', [
            'rows' => $rows,
            'byCourse' => $this->area->byCourse($rows),
        ]);
    }
}
