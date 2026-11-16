<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Company;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Lesson;
use App\Models\LessonProgress;
use App\Models\Module;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Rapidez (revisão V1, A13/A21/A22): o número de consultas à base de dados de cada página não pode crescer
 * com o tamanho da equipa. Equipa de 30 pessoas, 4 cursos de 5 aulas, com progresso, testes e certificados.
 */
class PerformanceTest extends TestCase
{
    use RefreshDatabase;

    private Company $company;

    private User $leader;

    private User $trainer;

    protected function setUp(): void
    {
        parent::setUp();
        foreach (['aluno', 'formador', 'admin', 'team_leader', 'gestor_cursos'] as $r) {
            Role::firstOrCreate(['name' => $r]);
        }
        $roles = Role::pluck('id', 'name');
        $cat = Category::create(['slug' => 'mecanica', 'name' => 'Mecânica', 'color_hex' => '#F8B101']);
        $this->trainer = User::factory()->create(['role_id' => $roles['formador']]);
        $this->company = Company::create(['ulid' => (string) Str::ulid(), 'name' => 'Oficina Grande', 'packs' => 3]);

        $courses = collect(range(1, 4))->map(function ($i) use ($cat) {
            $c = Course::create([
                'ulid' => (string) Str::ulid(), 'category_id' => $cat->id, 'title' => "Curso $i", 'slug' => "curso-$i",
                'level' => 'iniciante', 'status' => 'published', 'price' => 49, 'instructor_id' => $this->trainer->id,
                'requires_attendance' => true, 'certificate_enabled' => true,
            ]);
            $m = Module::create(['course_id' => $c->id, 'title' => 'M', 'order_index' => 0]);
            foreach (range(0, 4) as $li) {
                $l = Lesson::create(['module_id' => $m->id, 'title' => "Aula $li", 'content_type' => $li === 4 ? 'quiz' : 'text', 'body' => 'x', 'order_index' => $li]);
                if ($li === 4) {
                    $q = $l->quiz()->create(['title' => 'Teste']);
                    $qq = $q->questions()->create(['question' => '?', 'order_index' => 0]);
                    $qq->options()->create(['option_text' => 'a', 'is_correct' => true]);
                }
            }

            return $c;
        });
        $this->company->courses()->attach($courses->pluck('id'));

        foreach (range(1, 30) as $i) {
            $u = User::factory()->create(['role_id' => $i === 1 ? $roles['team_leader'] : $roles['aluno'], 'company_id' => $this->company->id, 'last_active_at' => now()]);
            if ($i === 1) $this->leader = $u;
            foreach ($courses as $ci => $c) {
                Enrollment::create(['user_id' => $u->id, 'course_id' => $c->id, 'company_id' => $this->company->id, 'source' => 'manual', 'enrolled_at' => now()]);
                foreach ($c->lessons()->get() as $li => $l) {
                    if (($i + $li + $ci) % 3 === 0) continue;
                    LessonProgress::create(['user_id' => $u->id, 'lesson_id' => $l->id, 'status' => 'completed', 'progress_percent' => 100]);
                }
                if ($i % 2) {
                    DB::table('quiz_attempts')->insert(['user_id' => $u->id, 'quiz_id' => $c->lessons()->where('content_type', 'quiz')->first()->quiz->id, 'score' => 80, 'passed' => true, 'attempted_at' => now()]);
                }
            }
        }
    }

    private function queries(User $user, string $url): int
    {
        $this->actingAs($user)->get($url)->assertOk(); // aquece (sessão, perfis)
        DB::flushQueryLog();
        DB::enableQueryLog();
        $this->actingAs($user)->get($url)->assertOk();
        $n = count(DB::getQueryLog());
        DB::disableQueryLog();

        return $n;
    }

    /** Mais 10 pessoas na equipa, inscritas nos 4 cursos, com aulas feitas. */
    private function growTeam(): void
    {
        $courses = $this->company->courses()->get();
        foreach (range(1, 10) as $i) {
            $u = User::factory()->create(['role_id' => Role::where('name', 'aluno')->value('id'), 'company_id' => $this->company->id, 'last_active_at' => now()]);
            foreach ($courses as $c) {
                Enrollment::create(['user_id' => $u->id, 'course_id' => $c->id, 'company_id' => $this->company->id, 'source' => 'manual', 'enrolled_at' => now()]);
                foreach ($c->lessons()->get() as $l) {
                    LessonProgress::create(['user_id' => $u->id, 'lesson_id' => $l->id, 'status' => 'completed', 'progress_percent' => 100]);
                }
            }
        }
    }

    public function test_the_number_of_queries_does_not_grow_with_the_team(): void
    {
        $student = User::where('company_id', $this->company->id)->where('id', '!=', $this->leader->id)->first();
        $pages = [
            'Início do team leader' => [$this->leader, '/dashboard'],
            'Equipa' => [$this->leader, '/equipa'],
            'Início do formador' => [$this->trainer, '/dashboard'],
            'Início do gestor' => [User::factory()->create(['role_id' => Role::where('name', 'gestor_cursos')->value('id')]), '/dashboard'],
            'Administração' => [User::factory()->create(['role_id' => Role::where('name', 'admin')->value('id')]), '/administracao/geral'],
            'Início do aluno' => [$student, '/dashboard'],
        ];
        $before = array_map(fn ($p) => $this->queries(...$p), $pages);
        $this->growTeam();
        $after = array_map(fn ($p) => $this->queries(...$p), $pages);

        // Com 30 ou 40 pessoas, as mesmas consultas (antes: 1080 no Início do team leader, 687 na Equipa, 432 no do formador)
        $this->assertSame($before, $after);
        foreach ($after as $page => $n) {
            $this->assertLessThan(60, $n, "$page faz $n consultas");
        }
    }
}
