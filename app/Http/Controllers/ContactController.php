<?php

namespace App\Http\Controllers;

use App\Http\Requests\ContactRequestForm;
use App\Models\ContactRequest;
use App\Models\Course;
use App\Services\TeamService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Contactos da plataforma: pedido de contacto, redes sociais e FAQs.
 */
class ContactController extends Controller
{
    /** Contactos da plataforma (menu da conta, ajuda da aula e entrada): com ou sem sessão. */
    public function show(Request $request): Response
    {
        return Inertia::render('Contacts', [
            'courses' => Course::where('status', 'published')->orderBy('title')->get(['id', 'title']),
            'teamSizes' => ContactRequest::TEAM_SIZES,
            'faqs' => config('tacademy.faqs'),
            'contact' => config('tacademy.contact'),
            'social' => config('tacademy.social'),
            'sent' => $request->session()->get('contact_sent'),
        ]);
    }

    /** O pedido entra nos Pedidos do Gestor de Cursos; com sessão, com o nome e o email da conta. */
    public function store(ContactRequestForm $request, TeamService $teams): RedirectResponse
    {
        $data = $request->validated();
        $this->createRequest($data, $teams, $request->user()?->id);

        return redirect()->route('contacts')->with('contact_sent', [
            'name' => strtok($data['name'], ' '),
            'email' => $data['email'],
        ]);
    }

    private function createRequest(array $data, TeamService $teams, ?int $userId = null): ContactRequest
    {
        $isCompany = $data['type'] === 'empresa';
        $people = $isCompany ? $this->parsePeople($data['participants'] ?? '') : [];

        $r = ContactRequest::create([
            ...collect($data)->except(['consent', 'website', 'participants'])->all(),
            // Empresa que já indica o curso → pedido de compra; o resto são esclarecimentos
            'kind' => $isCompany && ! empty($data['course_id']) ? 'compra' : 'esclarecimento',
            // Campos só de empresa não são guardados para particulares
            'company' => $isCompany ? ($data['company'] ?? null) : null,
            'team_size' => $isCompany ? ($data['team_size'] ?? null) : null,
            'people' => $people ?: null,
            'consent_at' => now(),
            'user_id' => $userId,
        ]);
        $r->messages()->create(['user_id' => $userId, 'author' => $r->name, 'body' => $r->message]);
        $teams->notifyStaff($r->load('course'));

        return $r;
    }

    /**
     * "Rui Silva, rui@oficina.pt" (ou ";" / tab / "Nome <email>") por linha → [['name','email'], …].
     * Linhas sem email válido são ignoradas; o gestor confirma a lista antes de criar a equipa.
     */
    private function parsePeople(string $text): array
    {
        return collect(preg_split('/\r\n|\r|\n/', $text))
            ->map(function ($line) {
                if (! preg_match('/[^\s<>,;]+@[^\s<>,;]+\.[^\s<>,;]+/', $line, $m)) return null;
                $name = trim(str_replace($m[0], '', $line), " \t,;<>-");

                return ['name' => $name ?: strtok($m[0], '@'), 'email' => strtolower($m[0])];
            })
            ->filter()->unique('email')->take(200)->values()->all();
    }
}
