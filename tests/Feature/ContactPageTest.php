<?php

namespace Tests\Feature;

use App\Models\ContactRequest;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ContactPageTest extends TestCase
{
    use RefreshDatabase;

    public function test_guests_open_the_contacts_page_with_socials_and_faqs(): void
    {
        $this->get('/plataforma/contactos')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('Contacts')
                ->where('social.linkedin.url', 'https://www.linkedin.com/company/t-academy/home/')
                ->where('social.instagram.url', 'https://www.instagram.com/gestao.de.talentos/')
                ->where('social.facebook.url', 'https://www.facebook.com/gestao.talentos')
                ->has('faqs.empresa')->has('faqs.particular'));
    }

    public function test_the_old_public_pages_redirect_to_the_platform(): void
    {
        $this->get('/contactos')->assertRedirect('/plataforma/contactos')->assertStatus(301);
        $this->get('/cursos')->assertRedirect('/plataforma/cursos')->assertStatus(301);
    }

    public function test_a_company_can_send_a_contact_request(): void
    {
        $this->post('/plataforma/contactos', [
            'type' => 'empresa',
            'name' => 'Rui Martins',
            'email' => 'rui@oficina.pt',
            'company' => 'Oficina Lisboa',
            'team_size' => '6-20',
            'message' => 'Queremos formar a equipa em diagnóstico.',
            'consent' => '1',
        ])->assertRedirect(route('contacts'))
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
        $this->post('/plataforma/contactos', [
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
        $this->post('/plataforma/contactos', [
            'type' => 'empresa',
            'name' => 'Rui',
            'email' => 'nao-e-email',
            'message' => 'Olá, tenho uma dúvida.',
        ])->assertSessionHasErrors(['email', 'company', 'consent']);

        $this->assertDatabaseCount('contact_requests', 0);
    }

    public function test_bots_filling_the_hidden_field_are_rejected(): void
    {
        $this->post('/plataforma/contactos', [
            'type' => 'particular',
            'name' => 'Bot',
            'email' => 'bot@spam.com',
            'message' => 'Compre já!',
            'consent' => '1',
            'website' => 'http://spam.example',
        ])->assertSessionHasErrors('website');

        $this->assertDatabaseCount('contact_requests', 0);
    }

    public function test_signed_in_users_send_requests_with_their_account_details(): void
    {
        $user = \App\Models\User::factory()->create(['name' => 'Rita Lopes', 'email' => 'rita@oficina.pt']);

        $this->actingAs($user)->get('/plataforma/contactos')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('Contacts')->has('faqs.empresa')->where('sent', null));

        // O nome e o email vêm sempre da conta, mesmo que o pedido traga outros
        $this->actingAs($user)->post('/plataforma/contactos', [
            'type' => 'particular',
            'name' => 'Outra Pessoa',
            'email' => 'outra@mail.pt',
            'message' => 'Não consigo abrir o vídeo da aula 3.',
            'consent' => '1',
        ])->assertRedirect(route('contacts'))->assertSessionHas('contact_sent');

        $this->assertDatabaseHas('contact_requests', [
            'user_id' => $user->id, 'name' => 'Rita Lopes', 'email' => 'rita@oficina.pt', 'kind' => 'esclarecimento', 'status' => 'novo',
        ]);
        $this->get('/plataforma/contactos')->assertInertia(fn ($page) => $page->where('sent.email', 'rita@oficina.pt'));
    }

}
