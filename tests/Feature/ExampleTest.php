<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_root_opens_the_platform_entry(): void
    {
        // O website saiu de /: a raiz é a entrada da plataforma
        $this->get('/')->assertOk()->assertInertia(fn ($p) => $p->component('Auth/Entrada'));
    }

    public function test_home_redirects_to_the_landing_page(): void
    {
        $this->get('/home')->assertRedirect('/')->assertStatus(301);
    }
}
