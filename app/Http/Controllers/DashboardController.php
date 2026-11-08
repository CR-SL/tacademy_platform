<?php

namespace App\Http\Controllers;

use App\Services\StudentArea;
use App\Services\Tasks;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Início: o dashboard em painéis (ver PRODUCT.md, "Nova aparência da plataforma"). */
class DashboardController extends Controller
{
    public function __invoke(Request $request, StudentArea $area, Tasks $tasks): Response
    {
        $user = $request->user();
        $courses = $area->courses($user);
        $messages = $area->messages($user);
        // Pendentes: a lista de tarefas de cada perfil (mensagens, cursos atribuídos, equipa, presenças, prazos, testes)
        $pending = [...$area->deadlines($user), ...$area->pending($user)];
        $pending = [...$tasks->forUser($user, $courses, $messages, $pending), ...$pending];

        return Inertia::render('Dashboard', [
            'courses' => $courses,
            'resume' => $area->resume($user),
            'pending' => $pending,
            // Primeiro uso: sem cursos, o Início mostra três cursos reais do catálogo (os mais recentes)
            'starter' => $courses ? [] : $area->starter($user),
            'results' => $area->results($user, 3),
            'notes' => $area->notes($user),
            'messages' => $messages,
            'suggestions' => $area->suggestions($user),
            'alexUrl' => $area->alexUrl($user),
            'savedLayout' => $area->layout($user, 'home'),
        ]);
    }
}
