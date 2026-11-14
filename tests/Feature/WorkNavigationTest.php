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
            ->assertInertia(fn ($p) => $p->component('Dashboard')->where('auth.worksOnly', false)->where('auth.home', '/dashboard')
                ->where('learns', true)->has('courses')->has('suggestions')->has('documents')->missing('team')->missing('teaching')->missing('requests'));
        $leader = $this->user('team_leader', ['company_id' => Company::create(['name' => 'Oficina X', 'packs' => 1])->id]);
        // Team leader: as caixas de aprender e a da sua equipa
        $this->actingAs($leader)->get('/dashboard')->assertOk()->assertInertia(fn ($p) => $p->component('Dashboard')
            ->where('learns', true)->has('courses')->where('team.name', 'Oficina X')->has('team.attention'));

        // Sem "Fazer cursos", o aluno deixa de ter as caixas de aprender (e com ela volta a tê-las)
        $role = Role::where('name', 'formador')->first();
        $role->forceFill(['permissions' => ['cursos.criar', 'aprender']])->save();
        $this->actingAs($this->user('formador'))->get('/dashboard')->assertInertia(fn ($p) => $p->where('learns', true)->has('courses')->has('teaching'));
        $role->forceFill(['permissions' => null])->save();

        // Formador, gestor e admin: o mesmo Início de trabalho, só com as caixas das suas permissões
        $this->actingAs($this->user('formador'))->get('/dashboard')->assertOk()->assertInertia(fn ($p) => $p
            ->component('Dashboard')->where('auth.worksOnly', true)->where('auth.home', '/dashboard')
            ->where('learns', false)->has('pending')->has('teaching')->has('messages')->missing('courses')->missing('requests')->missing('overview')->missing('catalog'));
        $this->actingAs($this->user('gestor_cursos'))->get('/dashboard')->assertOk()->assertInertia(fn ($p) => $p
            ->component('Dashboard')->has('requests')->has('purchases')->has('teams')->missing('courses')->missing('teaching')->where('messages', null)->missing('overview')->missing('people'));
        $this->actingAs($this->user('admin'))->get('/dashboard')->assertOk()->assertInertia(fn ($p) => $p
            ->component('Dashboard')->has('overview')->has('attention')->has('people')->has('requests')->has('catalog')->has('teaching')->where('learns', false)->missing('courses')); // o admin não é aluno: sem caixas de aprender

        // A disposição das caixas do Início de trabalho fica guardada (até 16 caixas: o admin tem 13)
        $admin = $this->user('admin');
        $items = collect(range(1, 13))->mapWithKeys(fn ($i) => [str_repeat('a', $i) => ['x' => 0, 'y' => $i * 11, 'w' => 8, 'h' => 11]])->all();
        $this->actingAs($admin)->putJson('/plataforma/paineis/inicio', ['items' => $items, 'collapsed' => [], 'hidden' => ['a'], 'order' => []])->assertNoContent();
        $this->actingAs($admin)->get('/dashboard')->assertInertia(fn ($p) => $p->where('savedLayout.hidden', ['a']));

        // Quem ainda não mexeu nas caixas desde que há um só Início fica com a disposição que tinha
        $formador = $this->user('formador');
        $old = ['items' => ['cursos' => ['x' => 0, 'y' => 0, 'w' => 24, 'h' => 11]], 'collapsed' => [], 'hidden' => ['cursos'], 'order' => ['cursos']];
        $formador->forceFill(['panel_layouts' => ['formador' => $old]])->save();
        $this->actingAs($formador)->get('/dashboard')->assertInertia(fn ($p) => $p
            ->where('savedLayout.items.ensino.w', 24)->where('savedLayout.hidden', ['ensino'])->missing('savedLayout.items.cursos'));

        // O endereço antigo do Início do formador leva ao Início (com a conversa das mensagens)
        $this->actingAs($this->user('formador'))->get('/formador?conversa=3-7')->assertRedirect('/dashboard?conversa=3-7');
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

        $this->actingAs($formador)->get('/dashboard')->assertInertia(fn ($p) => $p
            ->component('Dashboard')
            ->where('teaching.0.title', 'Calibração de ADAS')
            ->where('teaching.0.students', 2)
            ->where('failing', 1)
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
