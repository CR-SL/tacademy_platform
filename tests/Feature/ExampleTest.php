<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_landing_page_returns_a_successful_response(): void
    {
        $this->get('/')
            ->assertStatus(200)
            ->assertSee('Um bom técnico')
            ->assertSee('Quem Somos');
    }

    public function test_home_redirects_to_the_landing_page(): void
    {
        $this->get('/home')->assertRedirect('/')->assertStatus(301);
    }
}
