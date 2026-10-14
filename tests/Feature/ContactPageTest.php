<?php

namespace Tests\Feature;

use App\Models\ContactRequest;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ContactPageTest extends TestCase
{
    use RefreshDatabase;

    public function test_contact_page_shows_form_socials_and_faqs(): void
    {
        $this->get('/contactos')
            ->assertOk()
            ->assertSee('Fala connosco.')
            ->assertSee('https://www.linkedin.com/company/t-academy/home/', false)
            ->assertSee('https://www.instagram.com/gestao.de.talentos/', false)
            ->assertSee('https://www.facebook.com/gestao.talentos', false)
            ->assertSee('Como inscrevo a minha equipa?')
            ->assertSee('Como compro um curso?');
    }

    public function test_a_company_can_send_a_contact_request(): void
    {
        $this->post('/contactos', [
            'type' => 'empresa',
            'name' => 'Rui Martins',
            'email' => 'rui@oficina.pt',
            'company' => 'Oficina Lisboa',
            'team_size' => '6-20',
            'message' => 'Queremos formar a equipa em diagnóstico.',
            'consent' => '1',
        ])->assertRedirect(route('contacts').'#pedir-contacto')
            ->assertSessionHas('contact_sent');

        $this->assertDatabaseHas('contact_requests', [
            'type' => 'empresa',
            'email' => 'rui@oficina.pt',
            'company' => 'Oficina Lisboa',
            'status' => 'novo',
        ]);
    }

    public function test_company_fields_are_not_stored_for_individuals(): void
    {
        $this->post('/contactos', [
            'type' => 'particular',
            'name' => 'Ana Sousa',
            'email' => 'ana@mail.pt',
            'company' => 'Ignorada',
            'team_size' => '1-5',
            'message' => 'Tenho uma dúvida sobre o curso.',
            'consent' => '1',
        ])->assertSessionHasNoErrors();

        $request = ContactRequest::firstOrFail();
        $this->assertNull($request->company);
        $this->assertNull($request->team_size);
    }

    public function test_validation_requires_company_for_companies_and_consent(): void
    {
        $this->post('/contactos', [
            'type' => 'empresa',
            'name' => 'Rui',
            'email' => 'nao-e-email',
            'message' => 'Olá, tenho uma dúvida.',
        ])->assertSessionHasErrors(['email', 'company', 'consent']);

        $this->assertDatabaseCount('contact_requests', 0);
    }

    public function test_bots_filling_the_hidden_field_are_rejected(): void
    {
        $this->post('/contactos', [
            'type' => 'particular',
            'name' => 'Bot',
            'email' => 'bot@spam.com',
            'message' => 'Compre já!',
            'consent' => '1',
            'website' => 'http://spam.example',
        ])->assertSessionHasErrors('website');

        $this->assertDatabaseCount('contact_requests', 0);
    }
}
