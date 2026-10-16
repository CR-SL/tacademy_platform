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

    public function test_the_public_catalog_lists_published_courses_for_guests(): void
    {
        $this->course('Diagnóstico de Sistemas OBD-II');
        $this->course('Curso em rascunho', 'draft');

        $this->get('/cursos')
            ->assertOk()
            ->assertSee('Diagnóstico de Sistemas OBD-II')
            ->assertDontSee('Curso em rascunho')
            ->assertSee('1 curso', false)
            ->assertSee('Diagnóstico Automóvel')
            ->assertDontSee('Já é formando');
    }

    public function test_each_card_links_to_its_course_detail(): void
    {
        $this->course('Redes CAN Bus no Automóvel');

        $this->get('/cursos')->assertSee('/cursos?curso=redes-can-bus-no-automovel', false);
    }

    public function test_the_platform_catalog_moved_and_still_requires_login(): void
    {
        $this->get('/plataforma/cursos')->assertRedirect(route('login'));

        $role = Role::firstOrCreate(['name' => 'aluno']);
        $user = User::factory()->create(['role_id' => $role->id]);
        $this->actingAs($user)->get('/plataforma/cursos')->assertOk();
    }
}
