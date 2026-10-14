<?php

namespace App\Http\Controllers;

use App\Http\Requests\ContactRequestForm;
use App\Models\ContactRequest;
use App\Models\Course;
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

    public function store(ContactRequestForm $request): RedirectResponse
    {
        $data = $request->validated();

        ContactRequest::create([
            ...collect($data)->except(['consent', 'website'])->all(),
            // Campos só de empresa não são guardados para particulares
            'company' => $data['type'] === 'empresa' ? ($data['company'] ?? null) : null,
            'team_size' => $data['type'] === 'empresa' ? ($data['team_size'] ?? null) : null,
            'consent_at' => now(),
        ]);

        return redirect()
            ->to(route('contacts').'#pedir-contacto')
            ->with('contact_sent', [
                'name' => strtok($data['name'], ' '),
                'email' => $data['email'],
            ]);
    }
}
