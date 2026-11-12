<?php

namespace App\Services;

use App\Mail\PlatformMail;
use App\Models\Company;
use App\Models\ContactRequest;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\LessonProgress;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Equipas de empresas (uma empresa = uma equipa) e os pedidos que as alimentam.
 * Só os Gestores de Cursos (e o admin) criam equipas e mudam membros; o team leader só vê.
 */
class TeamService
{
    /** Avisa os Gestores de Cursos de um pedido novo (email; na plataforma aparece no sino). */
    public function notifyStaff(ContactRequest $r): void
    {
        $to = User::whereHas('role', fn ($q) => $q->where('name', 'gestor_cursos'))->pluck('email')->all()
            ?: array_filter([config('tacademy.contact.email')]);
        if (! $to) return;

        // Cada gestor recebe na sua língua
        foreach ($to as $email) {
            PlatformMail::inLocaleOf(User::where('email', $email)->first() ?? 'pt', function () use ($r, $email) {
                $kind = __(ContactRequest::KINDS[$r->kind] ?? 'Pedido');
                PlatformMail::deliver($email, new PlatformMail(
                    subjectLine: __('Novo pedido #:id · :kind', ['id' => $r->id, 'kind' => $kind]),
                    heading: __('Novo pedido: :kind', ['kind' => $kind]),
                    lines: array_filter([
                        __('De: :who', ['who' => $r->name.($r->company ? " ({$r->company})" : '').' · '.$r->email]),
                        $r->course ? __('Curso: :course', ['course' => $r->course->title]) : null,
                        $r->change_type ? __('Alteração: :change', ['change' => __(ContactRequest::CHANGE_TYPES[$r->change_type] ?? $r->change_type)]) : null,
                    ]),
                    quote: $r->message,
                    actionText: __('Abrir pedido'),
                    actionUrl: url('/gestao/pedidos?pedido='.$r->id),
                ));
            });
        }
    }

    /** Cria a equipa a partir de um pedido de compra pago. */
    public function createFromRequest(ContactRequest $r, array $data, User $actor): Company
    {
        return DB::transaction(function () use ($r, $data, $actor) {
            $company = Company::create([
                'name' => $data['company'],
                'nif' => $data['nif'] ?? null,
                'packs' => $data['packs'],
            ]);
            $company->courses()->attach($data['course_ids']);
            $this->syncMembers($company, $data['people'], $data['leader'], $actor);

            $r->update(['status' => 'equipa_criada', 'company_id' => $company->id, 'assigned_to' => $r->assigned_to ?? $actor->id]);

            return $company;
        });
    }

    /**
     * Define os membros da equipa. `people` = [['name','email'], …]; `leader` = email do team leader.
     * Pessoas novas recebem convite; quem sai perde o acesso aos cursos da equipa (mantém certificados).
     */
    public function syncMembers(Company $company, array $people, string $leaderEmail, User $actor): void
    {
        $people = collect($people)
            ->map(fn ($p) => ['name' => trim($p['name']), 'email' => Str::lower(trim($p['email']))])
            ->unique('email')->values();
        $leaderEmail = Str::lower(trim($leaderEmail));

        if ($people->count() > $company->seats()) {
            throw ValidationException::withMessages(['people' => __('A equipa tem :seats lugares; há :people pessoas.', ['seats' => $company->seats(), 'people' => $people->count()])]);
        }
        if (! $people->contains('email', $leaderEmail)) {
            throw ValidationException::withMessages(['leader' => __('Escolhe o team leader entre os membros da equipa.')]);
        }
        // Quem já é de outra empresa não pode entrar nesta
        $taken = User::whereIn('email', $people->pluck('email'))->whereNotNull('company_id')->where('company_id', '!=', $company->id)->pluck('email');
        if ($taken->isNotEmpty()) {
            throw ValidationException::withMessages(['people' => __('Já pertence a outra equipa: :emails', ['emails' => $taken->implode(', ')])]);
        }

        DB::transaction(function () use ($company, $people, $leaderEmail) {
            $roles = Role::pluck('id', 'name');
            $courseIds = $company->courses()->pluck('courses.id');

            // Saem da equipa
            $company->users()->whereNotIn('email', $people->pluck('email'))->get()->each(function (User $u) use ($company, $roles) {
                Enrollment::where('user_id', $u->id)->where('company_id', $company->id)->delete();
                $u->forceFill([
                    'company_id' => null,
                    'role_id' => $u->hasRole('team_leader') ? $roles['aluno'] : $u->role_id,
                ])->save();
            });

            foreach ($people as $p) {
                $user = User::where('email', $p['email'])->first();
                $isNew = ! $user;
                if ($isNew) {
                    $user = User::create([
                        'name' => $p['name'],
                        'email' => $p['email'],
                        'password' => Hash::make(Str::random(40)), // define a sua no convite
                        'role_id' => $roles['aluno'],
                    ]);
                }
                $joined = $user->company_id !== $company->id;
                // Só alunos e team leaders mudam de perfil (um formador incluído na equipa continua formador)
                $role = $user->role?->name;
                if (in_array($role, ['aluno', 'team_leader'], true)) {
                    $user->role_id = $p['email'] === $leaderEmail ? $roles['team_leader'] : $roles['aluno'];
                }
                $user->company_id = $company->id;
                $user->save();

                foreach ($courseIds as $courseId) {
                    $this->enroll($user, $courseId, $company->id);
                }

                if ($joined) $this->invite($user, $company, $isNew);
            }
        });
    }

    /** Dá acesso ao curso; se o aluno já o tinha comprado, passa a contar também para a equipa. */
    public function enroll(User $user, int $courseId, ?int $companyId): Enrollment
    {
        $e = Enrollment::firstOrNew(['user_id' => $user->id, 'course_id' => $courseId]);
        if (! $e->exists) {
            $e->fill(['source' => 'manual', 'status' => 'active', 'enrolled_at' => now()]);
        }
        if ($companyId) $e->company_id = $companyId;
        $e->save();

        return $e;
    }

    private function invite(User $user, Company $company, bool $isNew): void
    {
        $courses = $company->courses()->pluck('title')->implode(', ');
        $first = Str::before($user->name, ' ');
        if ($isNew) {
            $token = Password::broker()->createToken($user);
            $url = url(route('password.reset', ['token' => $token, 'email' => $user->email], false));
            PlatformMail::inLocaleOf($user, fn () => PlatformMail::deliver($user->email, new PlatformMail(
                subjectLine: __('Bem-vindo à T.Academy (equipa :team)', ['team' => $company->name]),
                heading: __('Olá :name, já tens acesso à T.Academy', ['name' => $first]),
                lines: [__('Foste incluído na equipa :team, com acesso a: :courses.', ['team' => $company->name, 'courses' => $courses]), __('Define a tua palavra-passe para começar.')],
                actionText: __('Definir palavra-passe'),
                actionUrl: $url,
            )));
        } else {
            PlatformMail::inLocaleOf($user, fn () => PlatformMail::deliver($user->email, new PlatformMail(
                subjectLine: __('Foste incluído na equipa :team', ['team' => $company->name]),
                heading: __('Olá :name, tens novos cursos', ['name' => $first]),
                lines: [__('Foste incluído na equipa :team, com acesso a: :courses.', ['team' => $company->name, 'courses' => $courses])],
                actionText: __('Entrar na plataforma'),
                actionUrl: url('/dashboard'),
            )));
        }
    }

    /**
     * Porque é que uma pessoa da equipa (uma linha de report()['members']) precisa de atenção, ou null.
     * A mesma regra nos Pendentes do team leader e na caixa Equipa do Início.
     */
    public static function attentionReason(array $member): ?string
    {
        $courses = collect($member['courses']);

        return match (true) {
            $member['invited'] => __('Ainda não entrou'),
            $courses->contains(fn ($s) => $s['late']) => __('Fora do prazo'),
            $courses->contains(fn ($s) => $s['stalled']) => __('Parado há mais de 10 dias'),
            default => null,
        };
    }

    /**
     * Progresso da equipa nos cursos da equipa (só esses: compras pessoais não aparecem).
     *
     * @return array{courses: array, members: array}
     */
    public function report(Company $company): array
    {
        $courses = $company->courses()->orderBy('title')->get(['courses.id', 'courses.title']);
        $members = $company->users()->with('role')->orderBy('name')->get();
        $lessonIds = $courses->mapWithKeys(fn (Course $c) => [$c->id => $c->lessons()->pluck('lessons.id')]);

        return [
            'courses' => $courses->map(fn ($c) => ['id' => $c->id, 'title' => $c->title])->values()->all(),
            'members' => $members->map(function (User $u) use ($courses, $lessonIds, $company) {
                $progress = LessonProgress::where('user_id', $u->id)->whereIn('lesson_id', $lessonIds->flatten())->get();
                $enrolled = Enrollment::with('course')->where('user_id', $u->id)->where('company_id', $company->id)->get()->keyBy('course_id');

                return [
                    'id' => $u->id,
                    'name' => $u->name,
                    'email' => $u->email,
                    'leader' => $u->hasRole('team_leader'),
                    'invited' => $u->last_active_at === null && $progress->isEmpty(),
                    'remindersOff' => ! $u->email_reminders,
                    'courses' => $courses->mapWithKeys(function ($c) use ($u, $progress, $lessonIds, $enrolled) {
                        $ids = $lessonIds[$c->id];
                        $mine = $progress->whereIn('lesson_id', $ids);
                        $done = $mine->where('status', 'completed')->count();
                        $last = $mine->max('updated_at');
                        $e = $enrolled->get($c->id);
                        $deadline = $e?->deadlineInfo($ids->isNotEmpty() && $done >= $ids->count());

                        return [$c->id => [
                            'enrolled' => (bool) $e,
                            'due' => $deadline['date'] ?? null,
                            'dueInput' => $e?->due_at?->format('Y-m-d'),
                            'late' => $deadline['late'] ?? false,
                            'assigned' => $e?->assigned_at?->format('d/m/Y'),
                            'reminded' => $e?->reminded_at?->diffForHumans(),
                            'remindable' => $e && $u->email_reminders && ! $this->remindedRecently($e) && ($ids->isEmpty() || $done < $ids->count()),
                            'progress' => $ids->count() ? (int) round($done / $ids->count() * 100) : 0,
                            'score' => $this->quizScore($u->id, $ids),
                            'last' => $last ? \Illuminate\Support\Carbon::parse($last)->diffForHumans() : null,
                            'stalled' => $last && \Illuminate\Support\Carbon::parse($last)->lt(now()->subDays(10)) && $done < $ids->count(),
                            'certificate' => DB::table('certificates')->where('user_id', $u->id)->where('course_id', $c->id)->where('status', 'valid')->exists(),
                        ]];
                    })->all(),
                ];
            })->values()->all(),
        ];
    }

    /** Horas mínimas entre dois lembretes à mesma pessoa, no mesmo curso. */
    public const REMIND_EVERY_HOURS = 20;

    private function remindedRecently(Enrollment $e): bool
    {
        return (bool) $e->reminded_at?->gt(now()->subHours(self::REMIND_EVERY_HOURS));
    }

    /**
     * Lembrete por email às pessoas escolhidas, num curso da equipa. Quem já concluiu o curso,
     * recebeu um lembrete há pouco ou desligou os lembretes nas Definições fica de fora.
     *
     * @return array{sent: int, skipped: int}
     */
    public function remind(Company $company, User $leader, Course $course, array $memberIds, ?string $message): array
    {
        $lessonIds = $course->lessons()->pluck('lessons.id');
        $sent = 0;
        $members = $company->users()->whereIn('users.id', $memberIds)->get();

        foreach ($members as $u) {
            $e = Enrollment::with('course')->where('user_id', $u->id)->where('course_id', $course->id)->where('company_id', $company->id)->first();
            $done = LessonProgress::where('user_id', $u->id)->whereIn('lesson_id', $lessonIds)->where('status', 'completed')->count();
            $finished = $lessonIds->isNotEmpty() && $done >= $lessonIds->count();
            if (! $e || $finished || $this->remindedRecently($e) || ! $u->email_reminders) {
                continue;
            }

            $deadline = $e->deadlineInfo(false);
            $pct = $lessonIds->count() ? (int) floor($done / $lessonIds->count() * 100) : 0;
            $first = Str::before($u->name, ' ');
            $total = $lessonIds->count();
            PlatformMail::inLocaleOf($u, function () use ($u, $course, $done, $pct, $total, $deadline, $leader, $company, $message, $first) {
                $action = $this->entryAction($u, $course, $done ? __('Continuar o curso') : __('Começar o curso'));
                PlatformMail::deliver($u->email, new PlatformMail(
                    subjectLine: __('Lembrete: :course', ['course' => $course->title]),
                    heading: __('Olá :name, o curso :course está à tua espera', ['name' => $first, 'course' => $course->title]),
                    lines: array_filter([
                        $done ? __('Já fizeste :pct% do curso (:done de :total aulas).', ['pct' => $pct, 'done' => $done, 'total' => $total]) : __('Ainda não começaste o curso.'),
                        $deadline ? ($deadline['late'] ? __('O prazo terminou a :date.', ['date' => $deadline['date']]) : __('Prazo para concluir: :date.', ['date' => $deadline['date']])) : null,
                        __('Lembrete enviado por :leader, da equipa :team.', ['leader' => $leader->name, 'team' => $company->name]),
                    ]),
                    quote: $message ?: null,
                    actionText: $action['actionText'],
                    actionUrl: $action['actionUrl'],
                ));
            });
            $e->forceFill(['reminded_at' => now()])->save();
            $sent++;
        }

        return ['sent' => $sent, 'skipped' => count($memberIds) - $sent];
    }

    /**
     * Atribui um curso da equipa às pessoas escolhidas, com prazo opcional (data), e avisa-as por email.
     * Sem data, cada pessoa mantém o prazo que já tinha (o da empresa ou o do curso).
     */
    public function assign(Company $company, User $leader, Course $course, array $memberIds, ?string $due, ?string $message): int
    {
        $members = $company->users()->whereIn('users.id', $memberIds)->get();
        $dueDate = $due ? \Illuminate\Support\Carbon::parse($due) : null;

        DB::transaction(function () use ($members, $course, $company, $leader, $dueDate) {
            foreach ($members as $u) {
                $e = $this->enroll($u, $course->id, $company->id);
                $e->forceFill(['assigned_at' => now(), 'assigned_by' => $leader->id]);
                if ($dueDate) $e->due_at = $dueDate;
                $e->save();
            }
        });

        foreach ($members as $u) {
            $first = Str::before($u->name, ' ');
            $deadline = Enrollment::with('course')->where('user_id', $u->id)->where('course_id', $course->id)->first()?->deadlineInfo(false);
            PlatformMail::inLocaleOf($u, function () use ($u, $course, $deadline, $leader, $company, $message, $first) {
                $action = $this->entryAction($u, $course, __('Abrir o curso'));
                PlatformMail::deliver($u->email, new PlatformMail(
                    subjectLine: __('Tens um curso atribuído: :course', ['course' => $course->title]),
                    heading: __('Olá :name, tens um curso para fazer', ['name' => $first]),
                    lines: array_filter([
                        __(':leader, da equipa :team, atribuiu-te o curso :course.', ['leader' => $leader->name, 'team' => $company->name, 'course' => $course->title]),
                        $deadline ? __('Prazo para concluir: :date.', ['date' => $deadline['date']]) : null,
                    ]),
                    quote: $message ?: null,
                    actionText: $action['actionText'],
                    actionUrl: $action['actionUrl'],
                ));
            });
        }

        return $members->count();
    }

    /** Botão do email: quem ainda não entrou define primeiro a palavra-passe. */
    private function entryAction(User $u, Course $course, string $text): array
    {
        if ($u->last_active_at === null && ! LessonProgress::where('user_id', $u->id)->exists()) {
            $token = Password::broker()->createToken($u);

            return ['actionText' => __('Definir palavra-passe'), 'actionUrl' => url(route('password.reset', ['token' => $token, 'email' => $u->email], false))];
        }

        return ['actionText' => $text, 'actionUrl' => url('/plataforma/cursos/'.$course->slug)];
    }

    /** Média da melhor nota em cada quiz do curso (null se ainda não fez nenhum). */
    private function quizScore(int $userId, Collection $lessonIds): ?int
    {
        $best = DB::table('quiz_attempts')
            ->join('quizzes', 'quizzes.id', '=', 'quiz_attempts.quiz_id')
            ->whereIn('quizzes.lesson_id', $lessonIds)
            ->where('quiz_attempts.user_id', $userId)
            ->groupBy('quiz_attempts.quiz_id')
            ->selectRaw('MAX(quiz_attempts.score) as best')
            ->pluck('best');

        return $best->isEmpty() ? null : (int) round($best->avg());
    }
}
