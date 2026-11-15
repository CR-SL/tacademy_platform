<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NotFoundPageTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_missing_page_shows_the_platform_404_page(): void
    {
        $this->get('/esta-pagina-nao-existe', ['Accept' => 'text/html'])
            ->assertNotFound()
            ->assertInertia(fn ($p) => $p->component('Error')->where('status', 404));
    }

    public function test_the_404_page_follows_the_language_cookie(): void
    {
        $this->withUnencryptedCookie('lang', 'en')
            ->get('/nao-existe', ['Accept' => 'text/html'])
            ->assertNotFound()
            ->assertInertia(fn ($p) => $p->where('locale', 'en'));
    }

    public function test_json_and_file_requests_keep_the_plain_404(): void
    {
        $this->getJson('/api/nao-existe')->assertNotFound()->assertJsonMissing(['component' => 'Error']);
        $this->get('/images/nao-existe.png', ['Accept' => 'image/png'])->assertNotFound()->assertDontSee('data-page', false);
    }
}
