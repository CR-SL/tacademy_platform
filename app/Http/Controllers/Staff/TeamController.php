<?php

namespace App\Http\Controllers\Staff;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Models\ContactRequest;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\User;
use App\Services\TeamService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** "Equipas" do Gestor de Cursos e do admin: todas as equipas e os alunos individuais. */
class TeamController extends Controller
{
    public function __construct(private TeamService $teams) {}

    public function index(): Response
    {
        $companies = Company::with(['courses:id,title', 'users.role'])->withCount('users')->orderBy('name')->get();

        $individuals = User::whereHas('role', fn ($q) => $q->whereIn('name', ['aluno', 'team_leader']))
            ->whereHas('enrollments', fn ($q) => $q->whereNull('company_id'))
            ->with(['enrollments' => fn ($q) => $q->whereNull('company_id')->with('course:id,title'), 'company:id,name'])
            ->orderBy('name')->get();

        return Inertia::render('Staff/Teams', [
            'teams' => $companies->map(function (Company $c) {
                $leader = $c->users->first(fn ($u) => $u->hasRole('team_leader'));
                $enrolled = Enrollment::where('company_id', $c->id);

                return [
                    'ulid' => $c->ulid,
                    'name' => $c->name,
                    'nif' => $c->nif,
                    'members' => $c->users_count,
                    'seats' => $c->seats(),
                    'courses' => $c->courses->pluck('title'),
                    'leader' => $leader ? ['name' => $leader->name, 'email' => $leader->email] : null,
                    'completed' => (clone $enrolled)->where('status', 'completed')->count(),
                    'enrollments' => $enrolled->count(),
                    'created' => $c->created_at?->format('d/m/Y'),
                ];
            }),
            'individuals' => $individuals->map(fn (User $u) => [
                'name' => $u->name,
                'email' => $u->email,
                'team' => $u->company?->name,
                'last' => $u->last_active_at?->diffForHumans(),
                'courses' => $u->enrollments->map(fn ($e) => ['title' => $e->course?->title, 'status' => $e->status])->values(),
            ]),
            'newRequests' => ContactRequest::where('status', 'novo')->count(),
        ]);
    }

    public function show(Company $company): Response
    {
        return Inertia::render('Staff/TeamShow', [
            'team' => [
                'ulid' => $company->ulid,
                'name' => $company->name,
                'nif' => $company->nif,
                'packs' => $company->packs,
                'seats' => $company->seats(),
                'created' => $company->created_at?->format('d/m/Y'),
                'course_ids' => $company->courses()->pluck('courses.id'),
            ],
            'report' => $this->teams->report($company),
            'courses' => Course::where('status', 'published')->orderBy('title')->get(['id', 'title']),
            // Pedidos de alteração em aberto desta equipa
            'pending' => ContactRequest::where('company_id', $company->id)->where('kind', 'alteracao')->whereIn('status', ContactRequest::OPEN)
                ->latest()->get()->map(fn ($r) => [
                    'id' => $r->id,
                    'change' => ContactRequest::CHANGE_TYPES[$r->change_type] ?? $r->change_type,
                    'people' => $r->people ?? [],
                    'packs' => $r->packs,
                    'course_id' => $r->course_id,
                    'message' => $r->message,
                    'date' => $r->created_at?->format('d/m/Y'),
                ]),
        ]);
    }

    /** Membros, team leader, lugares e cursos da equipa (só o Gestor de Cursos/admin). */
    public function update(Request $request, Company $company): RedirectResponse
    {
        $data = $request->validate([
            'packs' => ['required', 'integer', 'between:1,50'],
            'course_ids' => ['required', 'array', 'min:1'],
            'course_ids.*' => [Rule::exists('courses', 'id')],
            'people' => ['required', 'array', 'min:1'],
            'people.*.name' => ['required', 'string', 'max:150'],
            'people.*.email' => ['required', 'email', 'max:150'],
            'leader' => ['required', 'email'],
            'resolve' => ['nullable', 'array'], // pedidos de alteração que ficam concluídos
            'resolve.*' => ['integer'],
        ], ['people.*.name.required' => 'Falta o nome.', 'people.*.email.*' => 'Email inválido.']);

        $company->update(['packs' => $data['packs']]);
        $company->courses()->sync($data['course_ids']);
        // Cursos retirados da equipa: os membros deixam de ter acesso por via da equipa
        Enrollment::where('company_id', $company->id)->whereNotIn('course_id', $data['course_ids'])->delete();
        $this->teams->syncMembers($company->fresh(), $data['people'], $data['leader'], $request->user());

        if (! empty($data['resolve'])) {
            ContactRequest::whereIn('id', $data['resolve'])->where('company_id', $company->id)
                ->update(['status' => 'concluido', 'assigned_to' => $request->user()->id]);
        }

        return back()->with('status', 'Equipa atualizada.');
    }
}
