<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Lesson;
use App\Models\Module;
use App\Models\Quiz;
use App\Models\QuizAttempt;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Navegação "só o seu trabalho" (opção D, 2026-11-09): o Início de cada perfil e as Avaliações do formador. */
class WorkNavigationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        foreach (['aluno', 'formador', 'admin', 'team_leader', 'gestor_cursos'] as $r) {
            Role::firstOrCreate(['name' => $r]);
        }
    }

    private function user(string $role, array $attrs = []): User
    {
        return User::factory()->create(['role_id' => Role::where('name', $role)->value('id'), ...$attrs]);
    }

    public function test_each_profile_starts_in_its_own_work(): void
    {
        $this->actingAs($this->user('aluno'))->get('/dashboard')->assertOk()
            ->assertInertia(fn ($p) => $p->component('Dashboard')->where('auth.worksOnly', false)->where('auth.home', '/dashboard'));
        $leader = $this->user('team_leader', ['company_id' => Company::create(['name' => 'Oficina X', 'packs' => 1])->id]);
        $this->actingAs($leader)->get('/dashboard')->assertOk()->assertInertia(fn ($p) => $p->component('Dashboard'));

        $this->actingAs($this->user('formador'))->get('/dashboard')->assertRedirect('/formador');
        $this->actingAs($this->user('gestor_cursos'))->get('/dashboard')->assertRedirect('/gestao/pedidos');
        $this->actingAs($this->user('admin'))->get('/dashboard')->assertRedirect('/administracao');

        // A ligação de uma mensagem leva o formador à conversa no seu Início
        $this->actingAs($this->user('formador'))->get('/dashboard?conversa=3-7')->assertRedirect('/formador?conversa=3-7');
        $this->actingAs($this->user('formador'))->get('/formador')->assertOk()
            ->assertInertia(fn ($p) => $p->component('Instructor/Home')->where('auth.worksOnly', true)->where('auth.home', '/formador'));
    }

    public function test_the_trainer_home_and_assessments_show_their_students_results(): void
    {
        $formador = $this->user('formador');
        $other = $this->user('formador');
        $ana = $this->user('aluno', ['name' => 'Ana Sousa']);
        $rui = $this->user('aluno', ['name' => 'Rui Matos']);

        $course = Course::create(['title' => 'Calibração de ADAS', 'slug' => 'calibracao-adas', 'status' => 'published', 'instructor_id' => $formador->id, 'price' => 100]);
        $module = Module::create(['course_id' => $course->id, 'title' => 'Radar', 'order_index' => 1]);
        $lesson = Lesson::create(['module_id' => $module->id, 'title' => 'Teste do radar', 'content_type' => 'quiz', 'order_index' => 0]);
        $quiz = Quiz::create(['lesson_id' => $lesson->id, 'title' => 'Quiz do radar', 'passing_score' => 70, 'max_attempts' => 2]);
        foreach ([$ana, $rui] as $u) {
            Enrollment::create(['user_id' => $u->id, 'course_id' => $course->id, 'enrolled_at' => now()]);
        }
        // A Ana falhou as duas tentativas; o Rui passou à segunda
        QuizAttempt::create(['user_id' => $ana->id, 'quiz_id' => $quiz->id, 'score' => 40, 'passed' => false, 'attempted_at' => now()->subDays(2)]);
        QuizAttempt::create(['user_id' => $ana->id, 'quiz_id' => $quiz->id, 'score' => 60, 'passed' => false, 'attempted_at' => now()->subDay()]);
        QuizAttempt::create(['user_id' => $rui->id, 'quiz_id' => $quiz->id, 'score' => 50, 'passed' => false, 'attempted_at' => now()->subDays(3)]);
        QuizAttempt::create(['user_id' => $rui->id, 'quiz_id' => $quiz->id, 'score' => 90, 'passed' => true, 'attempted_at' => now()->subDays(2)]);

        $this->actingAs($formador)->get('/formador')->assertInertia(fn ($p) => $p
            ->component('Instructor/Home')
            ->where('courses.0.title', 'Calibração de ADAS')
            ->where('courses.0.students', 2)
            ->where('attention', 1)
            ->where('assessments.0.student', 'Ana Sousa') // quem ainda não passou vem primeiro
            ->where('navCounts.ftests', 1));

        $this->actingAs($formador)->get('/formador/avaliacoes')->assertInertia(fn ($p) => $p
            ->component('Instructor/Assessments')
            ->has('rows', 2)
            ->where('rows.0.student', 'Ana Sousa')
            ->where('rows.0.best', 60)
            ->where('rows.0.attempts', 2)
            ->where('rows.0.out', true)
            ->where('rows.1.passed', true)
            ->where('byCourse.0.average', 75)
            ->where('byCourse.0.notPassed', 1));

        // Outro formador não vê os alunos deste curso; o aluno não entra
        $this->actingAs($other)->get('/formador/avaliacoes')->assertInertia(fn ($p) => $p->has('rows', 0));
        $this->actingAs($ana)->get('/formador')->assertForbidden();
    }
}
