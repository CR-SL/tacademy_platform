<?php

namespace App\Http\Controllers;

use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Lesson;
use App\Models\LessonProgress;
use App\Models\User;
use App\Services\LearningService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Dashboard "Centro de Missões" (Identidade Visual v3 · direção 4b).
 */
class DashboardController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('Dashboard', [
            'stats' => $this->stats($user->id),
            'continueCourse' => $this->continueCourse($user),
            ...$this->demoGamification($user),
        ]);
    }

    /**
     * Estatísticas do cartão de perfil: aulas concluídas, horas de estudo, certificados.
     *
     * @return array{lessons:int, hours:int, certificates:int}
     */
    private function stats(int $userId): array
    {
        $completed = LessonProgress::where('user_id', $userId)->where('status', 'completed');

        $seconds = Lesson::whereIn('id', (clone $completed)->select('lesson_id'))->sum('duration_seconds');

        return [
            'lessons' => $completed->count(),
            'hours' => (int) round($seconds / 3600),
            'certificates' => DB::table('certificates')
                ->where('user_id', $userId)
                ->where('status', 'valid')
                ->count(),
        ];
    }

    /**
     * Curso a retomar: inscrição ativa mais recente, com o estado de cada módulo
     * (concluído / atual / por fazer) para os segmentos do cartão "Continuar".
     */
    private function continueCourse(User $user): ?array
    {
        $userId = $user->id;
        $enrollment = Enrollment::with(['course.modules' => fn ($q) => $q->orderBy('order_index')->with('lessons:id,module_id')])
            ->where('user_id', $userId)
            ->where('status', 'active')
            ->latest('enrolled_at')
            ->first();

        if (! $enrollment || ! $enrollment->course) {
            return null;
        }

        $course = $enrollment->course;
        $doneIds = LessonProgress::where('user_id', $userId)
            ->where('status', 'completed')
            ->pluck('lesson_id')
            ->flip();

        $current = null;
        $modules = $course->modules->values()->map(function ($module, $i) use ($doneIds, &$current) {
            $lessons = $module->lessons;
            $done = $lessons->isNotEmpty() && $lessons->every(fn ($l) => $doneIds->has($l->id));

            if ($done) {
                return 'done';
            }
            if ($current === null) {
                $current = $i;

                return 'current';
            }

            return 'todo';
        })->all();

        return [
            'title' => $course->title,
            'url' => $this->resumeUrl($user, $course),
            'has_ai' => $course->lessons()->where('content_type', 'avatar')->exists(),
            'modules' => $modules,
            'current_module' => ($current ?? max(count($modules) - 1, 0)) + 1,
        ];
    }

    /**
     * Aula onde o aluno ficou: a última em que mexeu e ainda não concluiu (se ainda a pode abrir);
     * senão, a primeira por concluir que já esteja aberta, como o botão "Continuar" da página do curso.
     */
    private function resumeUrl(User $user, Course $course): string
    {
        $learning = app(LearningService::class);
        $course = $course->fresh();
        $lessons = $learning->lessons($course);
        $done = $learning->completedIds($user, $lessons);
        $access = $learning->access($user, $course);
        $unlocked = $learning->unlockedIds($course, $lessons, $done);
        $canOpen = fn ($l) => $learning->canOpen($access, $course, $l, $unlocked);

        $lastId = LessonProgress::where('user_id', $user->id)->whereIn('lesson_id', $lessons->pluck('id'))
            ->where('status', '!=', 'completed')->latest('updated_at')->value('lesson_id');
        $lesson = $lessons->first(fn ($l) => $l->id === $lastId && $canOpen($l))
            ?? $lessons->first(fn ($l) => ! $done->contains($l->id) && $canOpen($l))
            ?? $lessons->first();

        return '/plataforma/cursos/'.$course->slug.($lesson ? '/aulas/'.$lesson->ulid : '');
    }

    /**
     * Gamificação (XP, missões, feed da equipa, classificação, desafio de equipa).
     *
     * DADOS DE DEMONSTRAÇÃO: ainda não existem tabelas para missões/XP. Quando existirem,
     * substituir por queries reais e expor `POST /missions/{id}/claim` (devolve o novo XP);
     * o frontend já faz a atualização otimista.
     *
     * @return array<string, mixed>
     */
    private function demoGamification(User $user): array
    {
        $xp = 1240;

        return [
            'xp' => $xp,
            'missions' => [
                'daily' => [
                    ['id' => 'd1', 'title' => 'Concluir 1 aula', 'progress' => 1, 'target' => 1, 'reward_xp' => 50, 'claimed' => false],
                    ['id' => 'd2', 'title' => 'Acertar 5 perguntas no quiz', 'progress' => 5, 'target' => 5, 'reward_xp' => 40, 'claimed' => false],
                    ['id' => 'd3', 'title' => 'Estudar 20 minutos', 'progress' => 12, 'target' => 20, 'reward_xp' => 30, 'claimed' => false],
                ],
                'weekly' => [
                    ['id' => 'w1', 'title' => 'Concluir 3 aulas de Eletricidade', 'progress' => 2, 'target' => 3, 'reward_xp' => 150, 'claimed' => false],
                    ['id' => 'w2', 'title' => 'Estudar 5 dias esta semana', 'progress' => 5, 'target' => 5, 'reward_xp' => 200, 'claimed' => false],
                    ['id' => 'w3', 'title' => 'Obter 1 certificado', 'progress' => 0, 'target' => 1, 'reward_xp' => 500, 'claimed' => false],
                ],
                'team' => [
                    ['id' => 't1', 'title' => 'Oficina Lisboa: 40 aulas', 'progress' => 31, 'target' => 40, 'reward_xp' => 300, 'claimed' => false],
                    ['id' => 't2', 'title' => 'Toda a equipa com 1 quiz feito', 'progress' => 8, 'target' => 8, 'reward_xp' => 250, 'claimed' => false],
                ],
            ],
            'teamChallenge' => [
                'team' => 'Oficina Lisboa',
                'done' => 31,
                'target' => 40,
                'reward_xp' => 300,
            ],
            'feed' => [
                ['name' => 'Rui Martins', 'action' => 'concluiu Redes CAN Bus'],
                ['name' => 'Ana Sousa', 'action' => 'subiu para o Nível 7'],
                ['name' => 'João Pires', 'action' => 'ganhou o emblema Faísca'],
                ['name' => 'Marta Lopes', 'action' => 'começou Osciloscópio'],
                ['name' => 'Pedro Reis', 'action' => 'chegou a 10 dias seguidos'],
                ['name' => 'Inês Costa', 'action' => 'acertou 10/10 no quiz OBD'],
            ],
            'leaderboard' => [
                ['name' => 'Rui Martins', 'xp' => 2140, 'me' => false],
                ['name' => 'Ana Sousa', 'xp' => 1890, 'me' => false],
                ['name' => $user->name, 'xp' => $xp, 'me' => true],
                ['name' => 'João Pires', 'xp' => 980, 'me' => false],
            ],
        ];
    }
}
