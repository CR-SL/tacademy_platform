<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Lupa do topo: só categorias e cursos (2026-11-24). */
class PlatformSearchTest extends TestCase
{
    use RefreshDatabase;

    private Course $course;

    protected function setUp(): void
    {
        parent::setUp();
        foreach (['aluno', 'formador', 'admin'] as $r) {
            Role::firstOrCreate(['name' => $r]);
        }
        $area = Category::create(['name' => 'Diagnóstico Automóvel', 'slug' => 'diagnostico']);
        $teacher = $this->user('formador');
        $this->course = Course::create([
            'title' => 'Calibração de ADAS', 'slug' => 'calibracao-adas', 'status' => 'published', 'category_id' => $area->id,
            'instructor_id' => $teacher->id, 'price' => 100, 'is_free' => false,
        ]);
        Course::create(['title' => 'Rascunho secreto ADAS', 'slug' => 'rascunho', 'status' => 'draft', 'instructor_id' => $teacher->id, 'price' => 0]);
    }

    private function user(string $role): User
    {
        return User::factory()->create(['role_id' => Role::where('name', $role)->first()->id]);
    }

    private function group(array $r, string $key): ?array
    {
        return collect($r['groups'])->firstWhere('key', $key);
    }

    public function test_finds_published_courses_and_categories_ignoring_accents(): void
    {
        $r = $this->getJson('/plataforma/pesquisa?q=calibracao')->assertOk()->json();
        $this->assertSame(['Calibração de ADAS'], array_column($this->group($r, 'courses')['items'], 'title'));
        $this->assertSame('/plataforma/cursos?curso=calibracao-adas', $this->group($r, 'courses')['items'][0]['url']);

        $r = $this->getJson('/plataforma/pesquisa?q=diagnostico')->json();
        $this->assertSame('/plataforma/cursos?area=diagnostico', $this->group($r, 'categories')['items'][0]['url']);
        $this->assertSame(['Calibração de ADAS'], array_column($this->group($r, 'courses')['items'], 'title'), 'o curso também aparece pela categoria');

        // Rascunhos não aparecem a quem não está inscrito
        $r = $this->getJson('/plataforma/pesquisa?q=secreto')->json();
        $this->assertSame([], $r['groups']);
    }

    public function test_an_enrolled_student_opens_the_course_in_my_courses(): void
    {
        $student = $this->user('aluno');
        Enrollment::create(['user_id' => $student->id, 'course_id' => $this->course->id, 'enrolled_at' => now()]);

        $item = $this->group($this->actingAs($student)->getJson('/plataforma/pesquisa?q=adas')->json(), 'courses')['items'][0];
        $this->assertSame('/plataforma/meus-cursos?curso=calibracao-adas', $item['url']);
    }

    public function test_short_or_empty_queries_return_nothing(): void
    {
        $this->getJson('/plataforma/pesquisa?q=a')->assertExactJson(['groups' => []]);
        $this->getJson('/plataforma/pesquisa')->assertExactJson(['groups' => []]);
    }
}
