<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Certificate;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Lesson;
use App\Models\LessonProgress;
use App\Models\Module;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class LearningTest extends TestCase
{
    use RefreshDatabase;

    private Course $course;

    /** @var Lesson[] */
    private array $l = [];

    protected function setUp(): void
    {
        parent::setUp();
        foreach (['aluno', 'formador', 'admin', 'team_leader', 'gestor_cursos'] as $r) {
            Role::firstOrCreate(['name' => $r]);
        }
        $cat = Category::create(['slug' => 'mecanica', 'name' => 'Mecânica', 'color_hex' => '#F8B101']);
        $this->course = Course::create([
            'ulid' => (string) Str::ulid(), 'category_id' => $cat->id, 'title' => 'Curso de teste', 'slug' => 'curso-de-teste',
            'level' => 'iniciante', 'status' => 'published', 'price' => 49, 'unlock_window' => 2,
            'certificate_enabled' => true, 'certificate_min_progress' => 100, 'certificate_min_score' => 70,
        ]);
        $m = Module::create(['course_id' => $this->course->id, 'title' => 'Módulo 1', 'order_index' => 0]);
        $this->l[0] = Lesson::create(['module_id' => $m->id, 'title' => 'Vídeo', 'content_type' => 'video_link', 'content_url' => 'https://www.youtube.com/watch?v=baKzmOEP9D8', 'duration_seconds' => 100, 'order_index' => 0]);
        $this->l[0]->checks()->create(['question' => 'Pergunta?', 'options' => ['A', 'B'], 'correct' => 1, 'explanation' => 'Porque sim.']);
        $this->l[1] = Lesson::create(['module_id' => $m->id, 'title' => 'Texto', 'content_type' => 'text', 'body' => 'Olá', 'duration_seconds' => 60, 'order_index' => 1]);
        $this->l[2] = Lesson::create(['module_id' => $m->id, 'title' => 'Teste', 'content_type' => 'quiz', 'duration_seconds' => 60, 'order_index' => 2]);
        $quiz = $this->l[2]->quiz()->create(['title' => 'Teste', 'passing_score' => 70, 'max_attempts' => 3]);
        foreach ([['2+2?', ['4', '5'], 0], ['Capital?', ['Porto', 'Lisboa'], 1]] as $i => [$q, $opts, $c]) {
            $qq = $quiz->questions()->create(['question' => $q, 'order_index' => $i]);
            foreach ($opts as $oi => $t) $qq->options()->create(['option_text' => $t, 'is_correct' => $oi === $c]);
        }
        $this->course->update(['sample_lesson_id' => $this->l[1]->id]);
    }

    private function user(string $role = 'aluno'): User
    {
        return User::factory()->create(['role_id' => Role::where('name', $role)->value('id')]);
    }

    private function student(): User
    {
        $u = $this->user();
        Enrollment::create(['user_id' => $u->id, 'course_id' => $this->course->id, 'source' => 'manual', 'enrolled_at' => now()]);

        return $u;
    }

    private function lessonUrl(int $i): string
    {
        return "/plataforma/cursos/curso-de-teste/aulas/{$this->l[$i]->ulid}";
    }

    /** Mapa de bits com os primeiros $n segundos vistos (base64). */
    private function map(int $n): string
    {
        $bytes = array_fill(0, intdiv($n + 7, 8), 0);
        for ($s = 0; $s < $n; $s++) $bytes[$s >> 3] |= 1 << ($s & 7);

        return base64_encode(pack('C*', ...$bytes));
    }

    public function test_the_course_page_shows_the_program_with_the_unlock_window(): void
    {
        $this->actingAs($this->student())->get('/plataforma/cursos/curso-de-teste')
            ->assertOk()
            ->assertInertia(fn ($p) => $p->component('Learn/Course')
                ->where('access.mode', 'enrolled')
                ->where('program.0.lessons.0.status', 'open')
                ->where('program.0.lessons.1.status', 'open')
                ->where('program.0.lessons.2.status', 'locked'));
    }

    public function test_locked_lessons_redirect_and_unlock_as_lessons_are_completed(): void
    {
        $u = $this->student();
        $this->actingAs($u)->get($this->lessonUrl(2))->assertRedirect('/plataforma/cursos/curso-de-teste');

        // A aula de texto fica concluída ao abrir, e isso desbloqueia o teste
        $this->actingAs($u)->get($this->lessonUrl(1))->assertOk()
            ->assertInertia(fn ($p) => $p->where('progress.status', 'completed')->where('next.open', true));
        $this->actingAs($u)->get($this->lessonUrl(2))->assertOk();
    }

    public function test_a_video_needs_90_percent_watched_and_the_quick_questions_answered(): void
    {
        $u = $this->student();
        $url = "/plataforma/aulas/{$this->l[0]->ulid}";

        $this->actingAs($u)->postJson("$url/progresso", ['position' => 50, 'map' => $this->map(50), 'duration' => 100])->assertJson(['watched' => 50, 'ready' => false, 'completed' => false]);

        // Rever o mesmo trecho não conta duas vezes; saltar não conta. Ainda falta a pergunta rápida
        $this->actingAs($u)->postJson("$url/progresso", ['position' => 90, 'map' => $this->map(90), 'duration' => 100])->assertJson(['watched' => 90, 'ready' => true, 'completed' => false]);
        $this->assertSame('in_progress', LessonProgress::where('user_id', $u->id)->where('lesson_id', $this->l[0]->id)->value('status'));

        // A última resposta conclui a aula sozinha
        $check = $this->l[0]->checks()->first();
        $this->actingAs($u)->postJson("$url/perguntas/{$check->id}", ['answer' => 0])->assertJson(['chosen' => 0, 'correct' => 1, 'explanation' => 'Porque sim.', 'completed' => true]);
        // Responder outra vez não muda a resposta
        $this->actingAs($u)->postJson("$url/perguntas/{$check->id}", ['answer' => 1])->assertJson(['chosen' => 0, 'completed' => false]);

        $this->assertSame('completed', LessonProgress::where('user_id', $u->id)->where('lesson_id', $this->l[0]->id)->value('status'));
    }

    public function test_answering_first_completes_the_video_when_it_reaches_90_percent(): void
    {
        $u = $this->student();
        $url = "/plataforma/aulas/{$this->l[0]->ulid}";
        $check = $this->l[0]->checks()->first();

        $this->actingAs($u)->postJson("$url/perguntas/{$check->id}", ['answer' => 1])->assertJson(['completed' => false]);
        $this->actingAs($u)->postJson("$url/progresso", ['position' => 90, 'map' => $this->map(90), 'duration' => 100])->assertJson(['completed' => true]);
    }

    public function test_a_video_is_not_completed_just_by_opening_it(): void
    {
        $this->l[0]->checks()->delete();
        $this->l[0]->update(['duration_seconds' => 0]); // duração ainda desconhecida

        $this->actingAs($this->student())->get($this->lessonUrl(0))->assertOk()
            ->assertInertia(fn ($p) => $p->where('progress.status', 'not_started'));
    }

    public function test_notes_are_saved_per_student_and_only_the_owner_deletes_them(): void
    {
        $u = $this->student();
        $url = "/plataforma/aulas/{$this->l[0]->ulid}/notas";

        $id = $this->actingAs($u)->postJson($url, ['body' => ' A chave é aqui. ', 'position' => 42])
            ->assertCreated()->assertJson(['position' => 42, 'body' => 'A chave é aqui.'])->json('id');
        $this->actingAs($u)->postJson($url, ['body' => ''])->assertUnprocessable();

        $this->actingAs($u)->get($this->lessonUrl(0))->assertInertia(fn ($p) => $p->has('notes', 1)->where('notes.0.position', 42));

        $other = $this->student();
        $this->actingAs($other)->get($this->lessonUrl(0))->assertInertia(fn ($p) => $p->has('notes', 0));
        $this->actingAs($other)->deleteJson("$url/$id")->assertNotFound();

        $this->actingAs($u)->deleteJson("$url/$id")->assertOk();
        $this->assertDatabaseMissing('lesson_notes', ['id' => $id]);
    }

    public function test_only_enrolled_students_can_save_notes(): void
    {
        $this->actingAs($this->user())->postJson("/plataforma/aulas/{$this->l[1]->ulid}/notas", ['body' => 'Olá'])->assertForbidden();
    }

    public function test_the_quiz_allows_three_attempts_and_reveals_answers_only_when_closed(): void
    {
        $u = $this->student();
        // as aulas anteriores marcam-se como concluídas diretamente para o teste
        foreach ([0, 1] as $i) LessonProgress::updateOrCreate(['user_id' => $u->id, 'lesson_id' => $this->l[$i]->id], ['status' => 'completed']);

        $q = $this->l[2]->quiz->questions()->with('options')->get();
        $wrong = [$q[0]->id => $q[0]->options[1]->id, $q[1]->id => $q[1]->options[0]->id];
        $right = [$q[0]->id => $q[0]->options[0]->id, $q[1]->id => $q[1]->options[1]->id];
        $quizUrl = "/plataforma/aulas/{$this->l[2]->ulid}/quiz";

        $this->actingAs($u)->post($quizUrl, ['answers' => $wrong])->assertSessionHasNoErrors();
        $this->actingAs($u)->get($this->lessonUrl(2))->assertInertia(fn ($p) => $p
            ->where('lesson.quiz.attempts.0.score', 0)
            ->where('lesson.quiz.questions.0.correct', null)); // ainda escondida

        $this->actingAs($u)->post($quizUrl, ['answers' => $right])->assertSessionHasNoErrors();
        $this->actingAs($u)->get($this->lessonUrl(2))->assertInertia(fn ($p) => $p
            ->where('lesson.quiz.passed', true)
            ->where('lesson.quiz.questions.0.correct', $q[0]->options[0]->id));

        $this->actingAs($u)->post($quizUrl, ['answers' => $right])->assertSessionHasErrors('quiz'); // já passou
    }

    public function test_finishing_the_course_issues_the_certificate(): void
    {
        $u = $this->student();
        LessonProgress::create(['user_id' => $u->id, 'lesson_id' => $this->l[0]->id, 'status' => 'completed']);
        $this->actingAs($u)->get($this->lessonUrl(1));
        $q =$this->l[2]->quiz->questions()->with('options')->get();
        $this->actingAs($u)->post("/plataforma/aulas/{$this->l[2]->ulid}/quiz", ['answers' => [
            $q[0]->id => $q[0]->options[0]->id, $q[1]->id => $q[1]->options[1]->id,
        ]]);

        $cert = Certificate::where('user_id', $u->id)->first();
        $this->assertNotNull($cert);
        $this->assertMatchesRegularExpression('/^TA-\d{4}-[A-Z0-9]{6}$/', $cert->certificate_number);
        $this->assertSame('completed', Enrollment::where('user_id', $u->id)->value('status'));
    }

    public function test_non_enrolled_students_see_only_the_sample_lesson_and_cannot_save(): void
    {
        $u = $this->user();
        $this->actingAs($u)->get('/plataforma/cursos/curso-de-teste')->assertInertia(fn ($p) => $p->where('access.mode', 'none')->where('sample.title', 'Texto'));
        $this->actingAs($u)->get($this->lessonUrl(1))->assertOk()->assertInertia(fn ($p) => $p->where('mode', 'sample'));
        $this->actingAs($u)->get($this->lessonUrl(0))->assertRedirect();
        $this->assertSame(0, LessonProgress::where('user_id', $u->id)->count()); // abrir a amostra não guarda progresso
    }

    public function test_staff_preview_opens_every_lesson_without_saving(): void
    {
        $admin = $this->user('admin');
        $this->actingAs($admin)->get($this->lessonUrl(2))->assertOk()->assertInertia(fn ($p) => $p->where('mode', 'preview'));
        $this->actingAs($admin)->postJson("/plataforma/aulas/{$this->l[0]->ulid}/progresso", ['position' => 1])->assertForbidden();
    }

    public function test_expired_access_closes_the_course(): void
    {
        $this->course->update(['access_months' => 1]);
        $u = $this->user();
        Enrollment::create(['user_id' => $u->id, 'course_id' => $this->course->id, 'source' => 'manual', 'enrolled_at' => now()->subMonths(2)]);

        $this->actingAs($u)->get('/plataforma/cursos/curso-de-teste')->assertInertia(fn ($p) => $p->where('access.mode', 'expired'));
        $this->actingAs($u)->get($this->lessonUrl(0))->assertRedirect();
    }
}
