<?php

namespace App\Http\Controllers\Staff;

use App\Http\Controllers\Controller;
use App\Mail\PlatformMail;
use App\Models\Company;
use App\Models\ContactRequest;
use App\Models\Course;
use App\Models\User;
use App\Services\TeamService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * "Pedidos" do Gestor de Cursos (e do admin): esclarecimentos, compras e alterações de equipa.
 * Responder (vai por email), mudar o estado, criar a equipa de um pedido pago e autorizar compras pessoais.
 */
class RequestController extends Controller
{
    public function __construct(private TeamService $teams) {}

    public function index(Request $request): Response
    {
        $requests = ContactRequest::with(['course:id,title', 'assignee:id,name', 'messages', 'team:id,name'])
            ->latest()->limit(300)->get();

        return Inertia::render('Staff/Requests', [
            'requests' => $requests->map(fn (ContactRequest $r) => [
                'id' => $r->id,
                'kind' => $r->kind,
                'type' => $r->type,
                'status' => $r->status,
                'name' => $r->name,
                'email' => $r->email,
                'phone' => $r->phone,
                'company' => $r->company,
                'nif' => $r->nif,
                'team_size' => $r->team_size,
                'course' => $r->course ? ['id' => $r->course->id, 'title' => $r->course->title] : null,
                'packs' => $r->packs,
                'people' => $r->people ?? [],
                'change_type' => $r->change_type,
                'team' => $r->team ? ['id' => $r->team->id, 'ulid' => $r->team->ulid, 'name' => $r->team->name] : null,
                'requester' => $r->user_id,
                'assignee' => $r->assignee?->name,
                'mine' => $r->assigned_to === $request->user()->id,
                'date' => $r->created_at?->format('d/m/Y H:i'),
                'ago' => $r->created_at?->diffForHumans(),
                'messages' => $r->messages->map(fn ($m) => [
                    'author' => $m->author, 'body' => $m->body, 'staff' => $m->from_staff, 'when' => $m->created_at?->format('d/m H:i'),
                ])->values(),
            ]),
            'open' => (int) $request->query('pedido') ?: null,
            'statuses' => ContactRequest::labels(ContactRequest::STATUSES),
            'kinds' => ContactRequest::labels(ContactRequest::KINDS),
            'changeTypes' => ContactRequest::labels(ContactRequest::CHANGE_TYPES),
            'courses' => Course::where('status', 'published')->orderBy('title')->get(['id', 'title']),
        ]);
    }

    public function reply(Request $request, ContactRequest $contactRequest): RedirectResponse
    {
        $data = $request->validate(['body' => ['required', 'string', 'min:2', 'max:5000']]);
        $me = $request->user();

        $contactRequest->messages()->create(['user_id' => $me->id, 'author' => $me->name, 'body' => $data['body'], 'from_staff' => true]);
        $contactRequest->update([
            'status' => $contactRequest->status === 'novo' ? 'em_esclarecimento' : $contactRequest->status,
            'assigned_to' => $contactRequest->assigned_to ?? $me->id,
        ]);

        $recipient = User::where('email', $contactRequest->email)->first();
        $sent = PlatformMail::inLocaleOf($recipient ?? 'pt', fn () => PlatformMail::deliver($contactRequest->email, new PlatformMail(
            subjectLine: __('Re: o seu pedido #:id · T.Academy', ['id' => $contactRequest->id]),
            heading: __('Olá :name,', ['name' => Str::before($contactRequest->name, ' ')]),
            lines: [__('A equipa de gestão de cursos da T.Academy respondeu ao seu pedido:')],
            quote: $data['body'],
        )));

        return back()->with('status', $sent ? __('Resposta enviada por email para :email.', ['email' => $contactRequest->email]) : __('Resposta guardada, mas o email não foi enviado (ver configuração de email).'));
    }

    public function update(Request $request, ContactRequest $contactRequest): RedirectResponse
    {
        $data = $request->validate([
            'status' => ['sometimes', Rule::in(array_keys(ContactRequest::STATUSES))],
            'assign' => ['sometimes', 'boolean'],
        ]);
        if (isset($data['status'])) $contactRequest->status = $data['status'];
        if (! empty($data['assign'])) $contactRequest->assigned_to = $request->user()->id;
        $contactRequest->save();

        return back();
    }

    /** Pedido de compra (empresa) pago → cria a equipa e envia os convites. */
    public function createTeam(Request $request, ContactRequest $contactRequest): RedirectResponse
    {
        abort_unless($contactRequest->kind === 'compra' && $contactRequest->status === 'pago' && ! $contactRequest->company_id, 422, __('Este pedido não está pronto para criar equipa.'));

        $data = $request->validate([
            'company' => ['required', 'string', 'max:150'],
            'nif' => ['nullable', 'string', 'max:20'],
            'packs' => ['required', 'integer', 'between:1,50'],
            'course_ids' => ['required', 'array', 'min:1'],
            'course_ids.*' => [Rule::exists('courses', 'id')->where('status', 'published')],
            'people' => ['required', 'array', 'min:1'],
            'people.*.name' => ['required', 'string', 'max:150'],
            'people.*.email' => ['required', 'email', 'max:150'],
            'leader' => ['required', 'email'],
        ], ['people.*.name.required' => __('Falta o nome.'), 'people.*.email.*' => __('Email inválido.')]);

        $company = $this->teams->createFromRequest($contactRequest, $data, $request->user());

        return to_route('staff.teams.show', $company)->with('status', __('Equipa criada. Os convites foram enviados por email.'));
    }

    /** Compra a título pessoal (pagamento simulado, estado "Pago") → dá acesso ao curso. */
    public function authorizePurchase(Request $request, ContactRequest $contactRequest): RedirectResponse
    {
        abort_unless($contactRequest->kind === 'compra' && $contactRequest->type === 'particular' && $contactRequest->status === 'pago'
            && $contactRequest->user_id && $contactRequest->course_id, 422, __('Este pedido não é uma compra pessoal paga.'));

        $student = User::findOrFail($contactRequest->user_id);
        $this->teams->enroll($student, $contactRequest->course_id, null);
        $contactRequest->update(['status' => 'concluido', 'assigned_to' => $contactRequest->assigned_to ?? $request->user()->id]);

        PlatformMail::inLocaleOf($student, fn () => PlatformMail::deliver($student->email, new PlatformMail(
            subjectLine: __('Já tens acesso ao curso :course', ['course' => $contactRequest->course->title]),
            heading: __('Olá :name, o teu curso está pronto', ['name' => Str::before($student->name, ' ')]),
            lines: [__('A tua compra do curso :course foi autorizada.', ['course' => $contactRequest->course->title])],
            actionText: __('Começar o curso'),
            actionUrl: url('/plataforma/cursos'),
        )));

        return back()->with('status', __('Acesso autorizado. :name já tem o curso.', ['name' => $student->name]));
    }
}
