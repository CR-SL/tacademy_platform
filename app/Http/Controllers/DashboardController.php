<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\StudentArea;
use App\Services\Tasks;
use App\Services\WorkArea;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Início: uma só página para todos (2026-11-10), em caixas que se arrastam e redimensionam.
 * Cada caixa só existe para quem tem a permissão dela: as de aprender com "Fazer cursos"
 * (StudentArea), as de trabalho com a sua permissão (WorkArea).
 */
class DashboardController extends Controller
{
    public function __invoke(Request $request, StudentArea $area, Tasks $tasks, WorkArea $work): Response
    {
        $user = $request->user();
        $learns = $user->learns();
        $teaches = $user->canDo('cursos.criar');

        $courses = $learns ? $area->courses($user) : [];
        $messages = $learns || $teaches ? $area->messages($user) : ['threads' => [], 'canStart' => []];
        // Pendentes: a lista de tarefas de cada um (prazos, testes, mensagens, cursos atribuídos, equipa, presenças e trabalho)
        $pending = $learns ? [...$area->deadlines($user), ...$area->pending($user)] : [];
        $pending = [...$tasks->forUser($user, $courses, $messages, $pending), ...$pending, ...$work->tasks($user)];

        $learning = $learns ? [
            'courses' => $courses,
            'resume' => $area->resume($user),
            // Primeiro uso: sem cursos, o Início mostra três cursos reais do catálogo (os mais recentes)
            'starter' => $courses ? [] : $area->starter($user),
            'results' => $area->results($user, 3),
            'notes' => $area->notes($user),
            'suggestions' => $area->suggestions($user),
            'alexUrl' => $area->alexUrl($user),
        ] : [];

        return Inertia::render('Dashboard', [
            'learns' => $learns,
            'pending' => $pending,
            'messages' => $learns || $teaches ? $messages : null,
            ...$learning,
            ...$work->panels($user),
            'savedLayout' => $this->layout($user, $area),
        ]);
    }

    /**
     * A disposição das caixas (vista "inicio"). Quem ainda não mexeu desde que há um só Início
     * fica com a que tinha: a do aluno, ou a do Início de trabalho (onde "cursos" eram os cursos do formador).
     */
    private function layout(User $user, StudentArea $area): ?array
    {
        if ($saved = $area->layout($user, 'inicio')) {
            return $saved;
        }
        // Disposições de antes de haver um só Início (até a pessoa voltar a mexer nas caixas)
        foreach ($user->hasWork() ? ['trabalho', 'formador', 'home'] : ['home'] as $view) {
            if ($old = $area->layout($user, $view)) {
                return $view === 'home' ? $old : $this->renameTeaching($old);
            }
        }

        return null;
    }

    /** No Início de trabalho antigo, "cursos" eram os cursos do formador; agora chamam-se "ensino". */
    private function renameTeaching(array $layout): array
    {
        $swap = fn ($id) => $id === 'cursos' ? 'ensino' : $id;
        if (isset($layout['items']['cursos'])) {
            $layout['items']['ensino'] = $layout['items']['cursos'];
            unset($layout['items']['cursos']);
        }
        foreach (['collapsed', 'hidden', 'order'] as $k) {
            $layout[$k] = array_map($swap, $layout[$k] ?? []);
        }

        return $layout;
    }
}
