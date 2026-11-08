<?php

namespace App\Services;

use App\Models\Company;
use App\Models\Course;
use App\Models\CourseMessage;
use App\Models\Enrollment;
use App\Models\LessonProgress;
use App\Models\User;
use Illuminate\Support\Carbon;

/**
 * Notificações dentro da plataforma (opção B, decidida a 2026-11-08):
 * o que pede ação vai para a caixa "Pendentes" do Início (lista de tarefas de cada perfil)
 * e os números aparecem nos itens da navegação. O sino fica só para o gestor de cursos.
 * Só dados reais: nada aqui é inventado.
 */
class Tasks
{
    /** Dias sem atividade a partir dos quais uma pessoa da equipa conta como parada (o mesmo da página da equipa). */
    private const STALLED_DAYS = 10;

    public function __construct(private TeamService $teams, private LearningService $learning) {}

    /**
     * Tarefas que se juntam aos prazos e testes do aluno.
     *
     * @param  array  $courses  StudentArea::courses()
     * @param  array  $messages  StudentArea::messages()
     * @param  array  $already  tarefas que já existem (para não repetir o mesmo curso)
     */
    public function forUser(User $user, array $courses, array $messages, array $already = []): array
    {
        $tasks = [];
        $taken = collect($already)->pluck('url');

        // Mensagens por ler (aluno ← formador, formador ← aluno)
        foreach ($messages['threads'] as $t) {
            if ($t['unread'] < 1) {
                continue;
            }
            $tasks[] = [
                'kind' => 'Mensagem',
                'title' => $t['name'],
                'course' => $t['context'],
                'text' => trans_choice('{1} 1 mensagem por ler, :when.|[2,*] :count mensagens por ler, :when.', $t['unread'], ['when' => $t['when']]),
                'cta' => __('Ler a mensagem'),
                'url' => '/dashboard?conversa='.$t['key'],
            ];
        }

        // Cursos atribuídos pela empresa que ainda não começou (se já houver um prazo, a tarefa do prazo chega)
        foreach ($courses as $c) {
            if ($c['state'] !== 'novo' || empty($c['assigned']) || $c['expired'] || $taken->contains($c['url'])) {
                continue;
            }
            $tasks[] = [
                'kind' => 'Curso atribuído',
                'title' => $c['title'],
                'course' => __('pela tua empresa'),
                'text' => __('Atribuído a :date. Ainda não começaste.', ['date' => $c['assigned']]),
                'cta' => __('Começar o curso'),
                'url' => $c['url'],
            ];
        }

        // Team leader: quem da equipa precisa de atenção
        if ($user->hasRole('team_leader') && $user->company) {
            $people = $this->attention($user->company);
            if ($people) {
                $names = collect($people)->take(3)->implode(', ').(count($people) > 3 ? ' '.__('e mais :n', ['n' => count($people) - 3]) : '');
                $tasks[] = [
                    'kind' => 'Equipa',
                    'title' => trans_choice('{1} 1 pessoa precisa de atenção|[2,*] :count pessoas precisam de atenção', count($people)),
                    'course' => $user->company->name,
                    'text' => __(':names: fora do prazo, parado há mais de :days dias ou ainda sem entrar.', ['names' => $names, 'days' => self::STALLED_DAYS]),
                    'cta' => __('Ver a equipa'),
                    'url' => '/equipa',
                ];
            }
        }

        // Formador: presenças por confirmar (alunos que já fizeram as aulas e só esperam a presença para o certificado)
        if ($user->canDo('cursos.criar') || $user->canDo('cursos.todos')) {
            foreach ($this->attendanceWaiting($user) as $row) {
                $tasks[] = [
                    'kind' => 'Presença',
                    'title' => $row['course']->title,
                    'course' => trans_choice('{1} 1 aluno|[2,*] :count alunos', $row['count']),
                    'text' => trans_choice('{1} Um aluno já fez as aulas e espera que confirmes a presença para receber o certificado.|[2,*] :count alunos já fizeram as aulas e esperam que confirmes a presença para receberem o certificado.', $row['count']),
                    'cta' => __('Confirmar presença'),
                    'url' => '/formador/cursos?presenca='.$row['course']->ulid,
                ];
            }
        }

        return $tasks;
    }

    /** Números da navegação. Só conta o que pede ação. */
    public function navCounts(User $user): array
    {
        $counts = [];

        $counts['home'] = CourseMessage::where('sender_id', '!=', $user->id)->whereNull('read_at')
            ->where(fn ($q) => $q->where('student_id', $user->id)
                ->orWhereIn('course_id', Course::where('instructor_id', $user->id)->select('id')))
            ->count();

        // Por começar = nenhuma aula concluída (a mesma regra de "Os meus cursos")
        $counts['mine'] = Enrollment::where('user_id', $user->id)->whereNotNull('assigned_at')
            ->whereDoesntHave('course.lessons', fn ($q) => $q->whereIn('lessons.id', LessonProgress::where('user_id', $user->id)->where('status', 'completed')->select('lesson_id')))
            ->count();

        if ($user->hasRole('team_leader') && $user->company) {
            $counts['team'] = count($this->attention($user->company));
        }
        if ($user->canDo('cursos.criar') || $user->canDo('cursos.todos')) {
            $counts['builder'] = collect($this->attendanceWaiting($user))->sum('count');
        }

        return array_filter($counts);
    }

    /** Nomes de quem precisa de atenção: a mesma regra da página da equipa (sem entrar, parado ou fora do prazo). */
    private function attention(Company $company): array
    {
        $report = $this->teams->report($company);

        return collect($report['members'])
            ->filter(fn ($m) => $m['invited'] || collect($m['courses'])->contains(fn ($s) => $s['stalled'] || $s['late']))
            ->pluck('name')->values()->all();
    }

    /** Cursos do formador que pedem presença, com quantos alunos já fizeram tudo e só falta a presença. */
    private function attendanceWaiting(User $user): array
    {
        $courses = Course::where('instructor_id', $user->id)->where('requires_attendance', true)->get();
        $out = [];
        foreach ($courses as $course) {
            $lessons = $this->learning->lessons($course);
            if ($lessons->isEmpty()) {
                continue;
            }
            $waiting = Enrollment::with('user')->where('course_id', $course->id)->whereNull('attended_at')->get()
                ->filter(fn ($e) => $e->user && $this->learning->completedIds($e->user, $lessons)->count() >= $lessons->count())
                ->count();
            if ($waiting) {
                $out[] = ['course' => $course, 'count' => $waiting];
            }
        }

        return $out;
    }
}
