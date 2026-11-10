<?php

namespace App\Http\Controllers;

use App\Services\StudentArea;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Páginas em painéis do aluno: os meus cursos, avaliações e documentos. */
class StudentAreaController extends Controller
{
    public function __construct(private StudentArea $area) {}

    public function courses(Request $request): Response
    {
        return Inertia::render('Student/MyCourses', [
            'courses' => $this->area->courses($request->user()),
            'alexUrl' => $this->area->alexUrl($request->user()),
            'savedLayout' => $this->area->layout($request->user(), 'cursos'),
        ]);
    }

    public function assessments(Request $request): Response
    {
        return Inertia::render('Student/Assessments', [
            'results' => $this->area->results($request->user()),
            'alexUrl' => $this->area->alexUrl($request->user()),
            'savedLayout' => $this->area->layout($request->user(), 'avaliacoes'),
        ]);
    }

    public function certificates(Request $request): Response
    {
        return Inertia::render('Student/Certificates', $this->area->certificates($request->user()));
    }

    public function documents(Request $request): Response
    {
        return Inertia::render('Student/Documents', [
            'courses' => $this->area->documents($request->user()),
            'alexUrl' => $this->area->alexUrl($request->user()),
            'savedLayout' => $this->area->layout($request->user(), 'documentos'),
        ]);
    }
}
