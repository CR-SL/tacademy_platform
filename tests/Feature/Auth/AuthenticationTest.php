<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthenticationTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_url_goes_to_the_landing(): void
    {
        // Já não há página de login: /login leva à landing, onde o login se faz pelo botão "Entrar"
        $this->get('/login')->assertRedirect(route('home'));
    }

    public function test_the_landing_login_box_is_hidden_until_opened(): void
    {
        $this->get('/')
            ->assertOk()
            ->assertSee('data-login-open', false)
            ->assertSee('data-login-pop', false)
            ->assertDontSee('data-open-on-load', false)
            ->assertSee('Entra na oficina.');
    }

    public function test_failed_login_from_the_box_returns_json_errors(): void
    {
        $user = User::factory()->create();

        $this->postJson('/login', ['email' => $user->email, 'password' => 'errada'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('email');

        $this->assertGuest();
    }

    public function test_users_can_authenticate_using_the_login_screen(): void
    {
        $user = User::factory()->create();

        $response = $this->post('/login', [
            'email' => $user->email,
            'password' => 'password',
        ]);

        $this->assertAuthenticated();
        $response->assertRedirect(route('dashboard', absolute: false));
    }

    public function test_users_can_not_authenticate_with_invalid_password(): void
    {
        $user = User::factory()->create();

        $this->post('/login', [
            'email' => $user->email,
            'password' => 'wrong-password',
        ]);

        $this->assertGuest();
    }

    public function test_users_can_logout(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->post('/logout');

        $this->assertGuest();
        $response->assertRedirect(route('login'));
        $response->assertSessionHas('status');
        $response->assertSessionHas('login_open');
    }

    public function test_after_logout_the_landing_opens_the_login_box_with_the_message(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->post('/logout');
        $this->followingRedirects()->get('/login')
            ->assertSee('data-open-on-load', false)
            ->assertSee('Sessão terminada. Até breve!');

        // Uma visita normal à landing começa com a caixa fechada
        $this->get('/')->assertDontSee('data-open-on-load', false);
    }
}
