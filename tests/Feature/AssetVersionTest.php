<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AssetVersionTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_page_opened_before_a_deploy_reloads_even_with_an_asset_url(): void
    {
        // No Railway há ASSET_URL; a versão tem de vir do manifest do build, senão uma página antiga pede ficheiros
        // que já não existem (página de erro até ao refresh)
        if (! is_file(public_path('build/manifest.json'))) {
            $this->markTestSkipped('Sem build do Vite.');
        }
        config(['app.asset_url' => 'https://tacademy.example']);
        $user = User::factory()->create();

        // A versão de antes (o hash do ASSET_URL, igual em todos os deploys) já não serve
        $this->actingAs($user)->get('/dashboard', ['X-Inertia' => 'true', 'X-Inertia-Version' => hash('xxh128', 'https://tacademy.example')])
            ->assertStatus(409)->assertHeader('X-Inertia-Location');
        $this->actingAs($user)->get('/dashboard', ['X-Inertia' => 'true', 'X-Inertia-Version' => hash_file('xxh128', public_path('build/manifest.json'))])
            ->assertOk();
    }
}
