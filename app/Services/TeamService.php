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

        $kind = ContactRequest::KINDS[$r->kind] ?? 'Pedido';
        PlatformMail::deliver($to, new PlatformMail(
            subjectLine: "Novo pedido #{$r->id} · {$kind}",
            heading: "Novo pedido: {$kind}",
            lines: array_filter([
                'De: '.$r->name.($r->company ? " ({$r->company})" : '').' · '.$r->email,
                $r->course ? 'Curso: '.$r->course->title : null,
                $r->change_type ? 'Alteração: '.(ContactRequest::CHANGE_TYPES[$r->change_type] ?? $r->change_type) : null,
            ]),
            quote: $r->message,
            actionText: 'Abrir pedido',
            actionUrl: url('/gestao/pedidos?pedido='.$r->id),
        ));
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
            throw ValidationException::withMessages(['people' => "A equipa tem {$company->seats()} lugares; há {$people->count()} pessoas."]);
        }
        if (! $people->contains('email', $leaderEmail)) {
            throw ValidationException::withMessages(['leader' => 'Escolhe o team leader entre os membros da equipa.']);
        }
        // Quem já é de outra empresa não pode entrar nesta
        $taken = User::whereIn('email', $people->pluck('email'))->whereNotNull('company_id')->where('company_id', '!=', $company->id)->pluck('email');
        if ($taken->isNotEmpty()) {
            throw ValidationException::withMessages(['people' => 'Já pertence a outra equipa: '.$taken->implode(', ')]);
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
            PlatformMail::deliver($user->email, new PlatformMail(
                subjectLine: "Bem-vindo à T.Academy — equipa {$company->name}",
                heading: "Olá {$first}, já tens acesso à T.Academy",
                lines: ["Foste incluído na equipa {$company->name}, com acesso a: {$courses}.", 'Define a tua palavra-passe para começar.'],
                actionText: 'Definir palavra-passe',
                actionUrl: $url,
            ));
        } else {
            PlatformMail::deliver($user->email, new PlatformMail(
                subjectLine: "Foste incluído na equipa {$company->name}",
                heading: "Olá {$first}, tens novos cursos",
                lines: ["Foste incluído na equipa {$company->name}, com acesso a: {$courses}."],
                actionText: 'Entrar na plataforma',
                actionUrl: url('/dashboard'),
            ));
        }
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
                $enrolled = Enrollment::where('user_id', $u->id)->where('company_id', $company->id)->pluck('course_id');

                return [
                    'id' => $u->id,
                    'name' => $u->name,
                    'email' => $u->email,
                    'leader' => $u->hasRole('team_leader'),
                    'invited' => $u->last_active_at === null && $progress->isEmpty(),
                    'courses' => $courses->mapWithKeys(function ($c) use ($u, $progress, $lessonIds, $enrolled) {
                        $ids = $lessonIds[$c->id];
                        $mine = $progress->whereIn('lesson_id', $ids);
                        $done = $mine->where('status', 'completed')->count();
                        $last = $mine->max('updated_at');

                        return [$c->id => [
                            'enrolled' => $enrolled->contains($c->id),
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
