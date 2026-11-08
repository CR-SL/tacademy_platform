<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProfileTest extends TestCase
{
    use RefreshDatabase;

    public function test_profile_page_is_displayed(): void
    {
        $user = User::factory()->create();

        $response = $this
            ->actingAs($user)
            ->get('/definicoes');

        $response->assertOk();
    }

    public function test_old_profile_address_goes_to_settings(): void
    {
        $this->actingAs(User::factory()->create())->get('/profile')->assertRedirect('/definicoes');
    }

    public function test_theme_is_saved_on_the_account(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->putJson('/definicoes/tema', ['theme' => 'system'])->assertNoContent();
        $this->assertSame('system', $user->refresh()->theme);

        $this->actingAs($user)->putJson('/definicoes/tema', ['theme' => 'roxo'])->assertUnprocessable();
        $this->assertSame('system', $user->refresh()->theme);
    }

    public function test_theme_needs_a_session(): void
    {
        $this->putJson('/definicoes/tema', ['theme' => 'dark'])->assertUnauthorized();
    }

    public function test_profile_information_can_be_updated(): void
    {
        $user = User::factory()->create();

        $response = $this
            ->actingAs($user)
            ->patch('/profile', [
                'name' => 'Test User',
                'email' => 'test@example.com',
            ]);

        $response
            ->assertSessionHasNoErrors()
            ->assertRedirect('/definicoes');

        $user->refresh();

        $this->assertSame('Test User', $user->name);
        $this->assertSame('test@example.com', $user->email);
        $this->assertNull($user->email_verified_at);
    }

    public function test_email_verification_status_is_unchanged_when_the_email_address_is_unchanged(): void
    {
        $user = User::factory()->create();

        $response = $this
            ->actingAs($user)
            ->patch('/profile', [
                'name' => 'Test User',
                'email' => $user->email,
            ]);

        $response
            ->assertSessionHasNoErrors()
            ->assertRedirect('/definicoes');

        $this->assertNotNull($user->refresh()->email_verified_at);
    }

    public function test_user_can_delete_their_account(): void
    {
        $user = User::factory()->create();

        $response = $this
            ->actingAs($user)
            ->delete('/profile', [
                'password' => 'password',
            ]);

        $response
            ->assertSessionHasNoErrors()
            ->assertRedirect('/');

        $this->assertGuest();
        // A conta fica apagada (soft delete): sai da plataforma, mas o histórico e os certificados ficam guardados
        $this->assertSoftDeleted($user);
    }

    public function test_correct_password_must_be_provided_to_delete_account(): void
    {
        $user = User::factory()->create();

        $response = $this
            ->actingAs($user)
            ->from('/definicoes')
            ->delete('/profile', [
                'password' => 'wrong-password',
            ]);

        $response
            ->assertSessionHasErrors('password')
            ->assertRedirect('/definicoes');

        $this->assertNotNull($user->fresh());
    }
}
