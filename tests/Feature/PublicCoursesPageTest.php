<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Course;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class PublicCoursesPageTest extends TestCase
{
    use RefreshDatabase;

    private function course(string $title, string $status = 'published'): Course
    {
        $category = Category::firstOrCreate(['slug' => 'diagnostico'], ['name' => 'Diagnóstico Automóvel', 'color_hex' => '#F8B101']);

        return Course::create([
            'ulid' => (string) Str::ulid(),
            'category_id' => $category->id,
            'title' => $title,
            'slug' => Str::slug($title),
            'description' => 'Descrição de '.$title,
            'level' => 'intermedio',
            'duration_minutes' => 50,
            'status' => $status,
            'price' => 49.90,
        ]);
    }

    public function test_guests_see_the_platform_catalog_with_published_courses_only(): void
    {
        $this->course('Diagnóstico de Sistemas OBD-II');
        $this->course('Curso em rascunho', 'draft');

        $this->get('/plataforma/cursos')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('Catalog')
                ->has('courses', 1)
                ->where('courses.0.title', 'Diagnóstico de Sistemas OBD-II')
                ->where('areas.0.name', 'Diagnóstico Automóvel')
                ->where('owned', []));
    }

    public function test_buying_without_a_session_signs_in_and_returns_to_the_course(): void
    {
        $this->course('Redes CAN Bus no Automóvel');

        $this->get('/plataforma/cursos?curso=redes-can-bus-no-automovel&entrar=1')
            ->assertRedirect(route('login'))
            ->assertSessionHas('url.intended', route('catalog', ['curso' => 'redes-can-bus-no-automovel']));
        $this->get('/plataforma/cursos?curso=redes-can-bus-no-automovel&entrar=1&conta=nova')->assertRedirect(route('register'));
        $this->post('/cursos/redes-can-bus-no-automovel/comprar')->assertRedirect(route('login'));
    }

    public function test_signed_in_users_still_open_the_catalog(): void
    {
        $role = Role::firstOrCreate(['name' => 'aluno']);
        $user = User::factory()->create(['role_id' => $role->id]);
        $this->actingAs($user)->get('/plataforma/cursos')->assertOk();
    }
}
