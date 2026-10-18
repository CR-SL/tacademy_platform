<?php

namespace App\Http\Controllers;

use App\Http\Requests\ContactRequestForm;
use App\Models\ContactRequest;
use App\Models\Course;
use App\Services\TeamService;
use Illuminate\Contracts\View\View;
use Illuminate\Http\RedirectResponse;

/**
 * Página pública de contactos: pedido de contacto, redes sociais e FAQs.
 */
class ContactController extends Controller
{
    public function show(): View
    {
        return view('contactos', [
            'courses' => Course::where('status', 'published')->orderBy('title')->get(['id', 'title']),
            'teamSizes' => ContactRequest::TEAM_SIZES,
            'faqs' => config('tacademy.faqs'),
            'contact' => config('tacademy.contact'),
            'social' => config('tacademy.social'),
        ]);
    }

    public function store(ContactRequestForm $request, TeamService $teams): RedirectResponse
    {
        $data = $request->validated();
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
        ]);
        $r->messages()->create(['author' => $r->name, 'body' => $r->message]);
        $teams->notifyStaff($r->load('course'));

        return redirect()
            ->to(route('contacts').'#pedir-contacto')
            ->with('contact_sent', [
                'name' => strtok($data['name'], ' '),
                'email' => $data['email'],
            ]);
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
