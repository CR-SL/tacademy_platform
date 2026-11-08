<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AuthenticationTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_entry_page_opens_at_the_root_and_at_login(): void
    {
        // A entrada da plataforma substituiu a landing: / e /login mostram o separador Entrar
        foreach (['/', '/login'] as $url) {
            $this->get($url)->assertOk()->assertInertia(fn (Assert $p) => $p
                ->component('Auth/Entrada')
                ->where('mode', 'entrar'));
        }
    }

    public function test_signed_in_users_go_straight_to_the_dashboard(): void
    {
        $this->actingAs(User::factory()->create())->get('/')->assertRedirect(route('dashboard', absolute: false));
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

        $this->from('/login')->post('/login', [
            'email' => $user->email,
            'password' => 'wrong-password',
        ])->assertRedirect('/login')->assertSessionHasErrors('email');

        $this->assertGuest();
    }

    public function test_after_logout_the_entry_shows_the_message(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->post('/logout');

        $this->assertGuest();
        $response->assertRedirect(route('login'))->assertSessionHas('status');

        $this->withSession(['status' => 'Sessão terminada. Até breve.'])->get('/login')
            ->assertInertia(fn (Assert $p) => $p->component('Auth/Entrada')->where('status', 'Sessão terminada. Até breve.'));
    }
}
