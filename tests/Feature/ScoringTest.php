<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Course;
use App\Models\Lesson;
use App\Models\Module;
use App\Models\Quiz;
use App\Models\QuizAttempt;
use App\Models\Role;
use App\Models\User;
use App\Services\LearningService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/** Pontuação dos testes (2026-11-27): automática por igual, pesos opcionais, exercícios sem nota e a nota final do curso. */
class ScoringTest extends TestCase
{
    use RefreshDatabase;

    private Course $course;

    private Module $module;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\RoleSeeder::class);
        $cat = Category::create(['name' => 'Diagnóstico', 'slug' => 'diagnostico']);
        $this->course = Course::create([
            'title' => 'Curso', 'slug' => 'curso', 'category_id' => $cat->id, 'level' => 'iniciante',
            'status' => 'published', 'is_free' => true, 'price' => 0,
        ]);
        $this->module = Module::create(['course_id' => $this->course->id, 'title' => 'M1', 'order_index' => 0]);
    }

    private function student(): User
    {
        $u = User::create(['name' => 'Aluno', 'email' => Str::random(8).'@exemplo.test', 'password' => 'x', 'role_id' => Role::where('name', 'aluno')->value('id')]);
        $u->forceFill(['email_verified_at' => now()])->save();

        return $u;
    }

    /** Teste com $n perguntas (pontos opcionais); a primeira opção é a certa. */
    private function quiz(array $points, bool $weighted = false, bool $graded = true, ?int $order = 0): Quiz
    {
        $lesson = Lesson::create(['module_id' => $this->module->id, 'kind' => $graded ? 'teste' : 'exercicio', 'title' => 'T', 'content_type' => 'quiz', 'evaluation' => 'quiz', 'order_index' => $order]);
        $quiz = $lesson->quiz()->create(['title' => 'T', 'passing_score' => 70, 'weighted' => $weighted, 'graded' => $graded]);
        foreach ($points as $i => $p) {
            $q = $quiz->questions()->create(['question' => "Q$i", 'points' => $p, 'order_index' => $i]);
            $q->options()->create(['option_text' => 'certa', 'is_correct' => true]);
            $q->options()->create(['option_text' => 'errada', 'is_correct' => false]);
        }

        return $quiz->load('questions.options');
    }

    private function answers(Quiz $quiz, array $rightIndexes): array
    {
        return $quiz->questions->values()->mapWithKeys(fn ($q, $i) => [$q->id => $q->options[in_array($i, $rightIndexes, true) ? 0 : 1]->id])->all();
    }

    public function test_by_default_every_question_is_worth_the_same(): void
    {
        $quiz = $this->quiz([1, 1, 1, 1, 1]);
        $attempt = app(LearningService::class)->submitQuiz($this->student(), $quiz->lesson, $this->answers($quiz, [0, 1, 2, 3]));
        $this->assertSame(80, $attempt->score); // 5 perguntas = 20% cada
        $this->assertTrue($attempt->passed);
    }

    public function test_with_weights_each_question_is_worth_its_points(): void
    {
        $quiz = $this->quiz([2, 1], weighted: true);
        $attempt = app(LearningService::class)->submitQuiz($this->student(), $quiz->lesson, $this->answers($quiz, [1]));
        $this->assertSame(33, $attempt->score); // acertou só a de peso 1 em 3
        $this->assertFalse($attempt->passed);
    }

    public function test_an_exercise_has_no_grade_and_can_be_repeated(): void
    {
        $quiz = $this->quiz([1, 1], graded: false);
        $u = $this->student();
        $first = app(LearningService::class)->submitQuiz($u, $quiz->lesson, $this->answers($quiz, []));
        $this->assertTrue($first->passed); // fica feito ao entregar
        app(LearningService::class)->submitQuiz($u, $quiz->lesson, $this->answers($quiz, [0]));
        $this->assertSame(2, QuizAttempt::where('user_id', $u->id)->count());
        // E não entra na nota do curso
        $lessons = app(LearningService::class)->lessons($this->course->fresh());
        $this->assertNull(app(LearningService::class)->courseScore($u, $this->course, $lessons));
    }

    public function test_the_course_grade_mixes_tests_and_the_final_evaluation_by_weight(): void
    {
        $test = $this->quiz([1, 1], order: 0);
        $u = $this->student();
        app(LearningService::class)->submitQuiz($u, $test->lesson, $this->answers($test, [0])); // 50%

        $this->course->update(['final_mode' => 'questions', 'final_weight' => 50]);
        $final = Quiz::create(['course_id' => $this->course->id, 'title' => 'Avaliação final', 'passing_score' => 70]);
        $q = $final->questions()->create(['question' => 'F', 'points' => 1, 'order_index' => 0]);
        $q->options()->create(['option_text' => 'certa', 'is_correct' => true]);
        QuizAttempt::create(['user_id' => $u->id, 'quiz_id' => $final->id, 'score' => 100, 'passed' => true, 'answers' => [], 'attempted_at' => now()]);

        $lessons = app(LearningService::class)->lessons($this->course->fresh());
        $this->assertSame(75, app(LearningService::class)->courseScore($u, $this->course->fresh(), $lessons)); // 50% x 50 + 100% x 50

        $this->course->update(['final_mode' => 'none']);
        $this->assertSame(50, app(LearningService::class)->courseScore($u, $this->course->fresh(), $lessons)); // só os testes
    }
    private function enrolled(): User
    {
        $u = $this->student();
        \App\Models\Enrollment::create(['user_id' => $u->id, 'course_id' => $this->course->id, 'status' => 'active', 'enrolled_at' => now()]);

        return $u;
    }

    public function test_a_practical_exercise_is_marked_as_done_by_the_student(): void
    {
        $u = $this->enrolled();
        $ex = Lesson::create(['module_id' => $this->module->id, 'kind' => 'exercicio', 'evaluation' => 'none', 'title' => 'Exercício', 'content_type' => 'text', 'body' => 'Identifica o compressor.', 'order_index' => 0]);
        // Abrir não o conclui
        $this->actingAs($u)->get("/plataforma/cursos/curso/aulas/{$ex->ulid}")->assertOk();
        $this->assertNull(\App\Models\LessonProgress::where('lesson_id', $ex->id)->where('status', 'completed')->first());
        $this->actingAs($u)->postJson("/plataforma/aulas/{$ex->ulid}/feito")->assertOk();
        $this->assertSame('completed', \App\Models\LessonProgress::where('lesson_id', $ex->id)->value('status'));
        // Só serve para exercícios práticos
        $aula = Lesson::create(['module_id' => $this->module->id, 'kind' => 'aula', 'parts' => ['notas'], 'title' => 'Aula', 'content_type' => 'text', 'body' => 'x', 'order_index' => 1]);
        $this->actingAs($u)->postJson("/plataforma/aulas/{$aula->ulid}/feito")->assertNotFound();
    }

    public function test_the_final_assessment_with_questions_is_submitted_on_the_course(): void
    {
        $u = $this->enrolled();
        $lesson = Lesson::create(['module_id' => $this->module->id, 'kind' => 'aula', 'parts' => ['notas'], 'title' => 'Aula', 'content_type' => 'text', 'body' => 'x', 'order_index' => 0]);
        $this->course->update(['final_mode' => 'questions']);
        $final = Quiz::create(['course_id' => $this->course->id, 'title' => 'Avaliação final', 'passing_score' => 50]);
        $q = $final->questions()->create(['question' => 'F', 'points' => 1, 'order_index' => 0]);
        $right = $q->options()->create(['option_text' => 'certa', 'is_correct' => true]);
        $q->options()->create(['option_text' => 'errada', 'is_correct' => false]);

        $this->actingAs($u)->get("/plataforma/cursos/curso/aulas/{$lesson->ulid}")
            ->assertInertia(fn ($p) => $p->where('finalEvaluation.mode', 'questions')->where('finalEvaluation.quiz.questions.0.value', 100));
        $this->actingAs($u)->post('/plataforma/cursos/curso/avaliacao-final', ['answers' => [$q->id => $right->id]])->assertRedirect();
        $this->assertSame(100, QuizAttempt::where('quiz_id', $final->id)->value('score'));
        $lessons = app(LearningService::class)->lessons($this->course->fresh());
        $this->assertSame(100, app(LearningService::class)->courseScore($u, $this->course->fresh(), $lessons));
    }
    public function test_the_assessment_button_opens_the_next_avatar_test_of_the_module(): void
    {
        $u = $this->enrolled();
        $m2 = Module::create(['course_id' => $this->course->id, 'title' => 'M2', 'order_index' => 1]);
        $aula1 = Lesson::create(['module_id' => $this->module->id, 'kind' => 'aula', 'parts' => ['notas'], 'title' => 'Aula 1', 'content_type' => 'text', 'body' => 'x', 'order_index' => 0]);
        $t1 = Lesson::create(['module_id' => $this->module->id, 'kind' => 'teste', 'evaluation' => 'avatar', 'title' => 'Teste M1', 'content_type' => 'avatar', 'order_index' => 1]);
        $aula2 = Lesson::create(['module_id' => $m2->id, 'kind' => 'aula', 'parts' => ['notas'], 'title' => 'Aula 2', 'content_type' => 'text', 'body' => 'x', 'order_index' => 0]);
        $t2 = Lesson::create(['module_id' => $m2->id, 'kind' => 'teste', 'evaluation' => 'avatar', 'title' => 'Teste M2', 'content_type' => 'avatar', 'order_index' => 1]);

        // Em cada módulo, o teste com avatar desse módulo
        $this->actingAs($u)->get("/plataforma/cursos/curso/aulas/{$aula1->ulid}")->assertInertia(fn ($p) => $p->where('avatarTest.ulid', $t1->ulid));
        $this->actingAs($u)->get("/plataforma/cursos/curso/aulas/{$aula2->ulid}")->assertInertia(fn ($p) => $p->where('avatarTest.ulid', $t2->ulid));
        // Feito o do módulo 1, o botão passa ao seguinte; feitos todos, não há teste (passa à avaliação final com avatar)
        \App\Models\LessonProgress::create(['user_id' => $u->id, 'lesson_id' => $t1->id, 'status' => 'completed', 'progress_percent' => 100, 'completed_at' => now()]);
        $this->actingAs($u)->get("/plataforma/cursos/curso/aulas/{$aula1->ulid}")->assertInertia(fn ($p) => $p->where('avatarTest.ulid', $t2->ulid));
        \App\Models\LessonProgress::create(['user_id' => $u->id, 'lesson_id' => $t2->id, 'status' => 'completed', 'progress_percent' => 100, 'completed_at' => now()]);
        $this->actingAs($u)->get("/plataforma/cursos/curso/aulas/{$aula1->ulid}")->assertInertia(fn ($p) => $p->where('avatarTest', null));
    }
}
