<?php

namespace App\Http\Controllers\Team;

use App\Http\Controllers\Controller;
use App\Models\ContactRequest;
use App\Models\Course;
use App\Services\TeamService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * "Equipa" do team leader: vê só a sua equipa e o progresso nos cursos da equipa.
 * Não muda membros — pede ao Gestor de Cursos ("Pedir alteração").
 */
class TeamController extends Controller
{
    public function __construct(private TeamService $teams) {}

    public function show(Request $request): Response
    {
        $company = $request->user()->company;
        abort_unless($company, 404);

        return Inertia::render('Team/Show', [
            'team' => [
                'id' => $company->id,
                'name' => $company->name,
                'seats' => $company->seats(),
                'packs' => $company->packs,
                'created' => $company->created_at?->format('d/m/Y'),
            ],
            'report' => $this->teams->report($company),
            'otherCourses' => Course::where('status', 'published')
                ->whereNotIn('id', $company->courses()->pluck('courses.id'))
                ->orderBy('title')->get(['id', 'title']),
            'changeTypes' => ContactRequest::CHANGE_TYPES,
        ]);
    }

    public function requestChange(Request $request): RedirectResponse
    {
        $user = $request->user();
        $company = $user->company;
        abort_unless($company, 404);

        $data = $request->validate([
            'change_type' => ['required', Rule::in(array_keys(ContactRequest::CHANGE_TYPES))],
            'name' => ['required_if:change_type,adicionar', 'nullable', 'string', 'max:150'],
            'email' => ['required_if:change_type,adicionar', 'nullable', 'email', 'max:150'],
            'member_id' => ['required_if:change_type,retirar', 'nullable', Rule::exists('users', 'id')->where('company_id', $company->id)],
            'packs' => ['required_if:change_type,lugares', 'nullable', 'integer', 'between:1,10'],
            'course_id' => ['required_if:change_type,curso', 'nullable', Rule::exists('courses', 'id')->where('status', 'published')],
            'message' => ['required_if:change_type,outro', 'nullable', 'string', 'max:3000'],
        ], [
            'required_if' => 'Preenche este campo.',
        ]);

        $people = match ($data['change_type']) {
            'adicionar' => [['name' => $data['name'], 'email' => $data['email']]],
            'retirar' => [$company->users()->whereKey($data['member_id'])->first(['name', 'email'])->only(['name', 'email'])],
            default => null,
        };
        $label = ContactRequest::CHANGE_TYPES[$data['change_type']];

        $r = ContactRequest::create([
            'kind' => 'alteracao',
            'type' => 'empresa',
            'status' => 'novo',
            'name' => $user->name,
            'email' => $user->email,
            'company' => $company->name,
            'company_id' => $company->id,
            'user_id' => $user->id,
            'change_type' => $data['change_type'],
            'people' => $people,
            'packs' => $data['change_type'] === 'lugares' ? $data['packs'] ?? null : null,
            'course_id' => $data['change_type'] === 'curso' ? $data['course_id'] ?? null : null,
            'message' => ($data['message'] ?? null) ?: $label,
        ]);
        $r->messages()->create(['user_id' => $user->id, 'author' => $user->name, 'body' => $r->message]);
        $this->teams->notifyStaff($r->load('course'));

        return back()->with('status', 'Pedido enviado — a equipa de gestão de cursos foi notificada.');
    }
}
