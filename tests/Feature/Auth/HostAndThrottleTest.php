<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\Facades\Notification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Tests\TestCase;

class HostAndThrottleTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Request::setTrustedHosts([]);
        parent::tearDown();
    }

    /** Como em produção: o filtro de domínios não corre em local nem nos testes. */
    private function asProduction(): void
    {
        config(['app.url' => 'https://tacademy.test']);
        $this->app->detectEnvironment(fn () => 'production');
    }

    public function test_requests_for_another_domain_are_refused_in_production(): void
    {
        $this->asProduction();

        $this->get('http://tacademy.test/login')->assertOk();
        $this->get('http://atacante.test/login')->assertStatus(400);
        $this->get('/login', ['X-Forwarded-Host' => 'atacante.test'])->assertStatus(400);
    }

    public function test_the_health_check_answers_on_any_domain(): void
    {
        $this->asProduction();

        $this->get('http://healthcheck.railway.app/up')->assertOk();
    }

    public function test_changing_ip_does_not_get_around_the_login_limit(): void
    {
        $user = User::factory()->create();

        // 20 tentativas erradas, cada uma de um IP diferente (5 por IP nunca é atingido)
        for ($i = 1; $i <= 20; $i++) {
            $this->withServerVariables(['REMOTE_ADDR' => "10.0.0.{$i}"])
                ->post('/login', ['email' => $user->email, 'password' => 'errada']);
        }

        // Já nem a palavra-passe certa entra, até passar o tempo
        $this->withServerVariables(['REMOTE_ADDR' => '10.0.1.1'])
            ->post('/login', ['email' => $user->email, 'password' => 'password'])
            ->assertSessionHasErrors('email');
        $this->assertGuest();
    }

    public function test_forgot_password_answers_the_same_whether_the_account_exists_or_not(): void
    {
        Notification::fake();
        $user = User::factory()->create();

        $known = $this->from('/forgot-password')->post('/forgot-password', ['email' => $user->email]);
        $unknown = $this->from('/forgot-password')->post('/forgot-password', ['email' => 'ninguem@exemplo.test']);
        $again = $this->from('/forgot-password')->post('/forgot-password', ['email' => $user->email]); // pedido há pouco

        foreach ([$known, $unknown, $again] as $response) {
            $response->assertSessionHasNoErrors()->assertSessionHas('status', __('Se existir uma conta com este email, enviámos-te um link para criares uma palavra-passe nova.'));
        }
        Notification::assertSentToTimes($user, ResetPassword::class, 1);
    }

    public function test_forgot_password_and_register_have_a_limit(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->from('/forgot-password')->post('/forgot-password', ['email' => "x{$i}@exemplo.test"])->assertSessionHasNoErrors();
        }
        // O 6.º pedido volta ao formulário com o aviso (não a página de erro 429)
        $this->from('/forgot-password')->post('/forgot-password', ['email' => 'x9@exemplo.test'])
            ->assertRedirect('/forgot-password')->assertSessionHasErrors('email');

        for ($i = 0; $i < 10; $i++) {
            $this->post('/register', ['name' => 'Bot', 'email' => "bot{$i}@exemplo.test", 'password' => 'palavra-nova-1234']);
            $this->post('/logout');
        }
        $this->from('/register')->post('/register', ['name' => 'Bot', 'email' => 'bot99@exemplo.test', 'password' => 'palavra-nova-1234'])
            ->assertSessionHasErrors('email');
        $this->assertFalse(User::where('email', 'bot99@exemplo.test')->exists());
    }

    public function test_the_hidden_field_stops_registration_robots(): void
    {
        $this->post('/register', ['name' => 'Bot', 'email' => 'bot@exemplo.test', 'password' => 'palavra-nova-1234', 'website' => 'http://spam.test'])
            ->assertSessionHasErrors('website');
        $this->assertFalse(User::where('email', 'bot@exemplo.test')->exists());
    }

    public function test_new_passwords_need_ten_characters(): void
    {
        $this->post('/register', ['name' => 'Ana', 'email' => 'ana@exemplo.test', 'password' => 'curta-123'])
            ->assertSessionHasErrors('password');
        $this->assertGuest();
    }
}
