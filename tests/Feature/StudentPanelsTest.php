<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\CourseMessage;
use App\Models\Enrollment;
use App\Models\Lesson;
use App\Models\LessonAttachment;
use App\Models\LessonNote;
use App\Models\LessonProgress;
use App\Models\Module;
use App\Models\Quiz;
use App\Models\QuizAttempt;
use App\Models\QuizOption;
use App\Models\QuizQuestion;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StudentPanelsTest extends TestCase
{
    use RefreshDatabase;

    private Course $course;

    private User $student;

    private User $instructor;

    /** @var Lesson[] */
    private array $lessons = [];

    protected function setUp(): void
    {
        parent::setUp();
        foreach (['aluno', 'formador', 'admin', 'team_leader', 'gestor_cursos'] as $r) {
            Role::firstOrCreate(['name' => $r]);
        }
        $this->instructor = $this->user('formador');
        $this->student = $this->user('aluno');
        $this->course = Course::create([
            'title' => 'Calibração de ADAS', 'slug' => 'calibracao-adas', 'status' => 'published',
            'instructor_id' => $this->instructor->id, 'price' => 100, 'is_free' => false,
        ]);
        $module = Module::create(['course_id' => $this->course->id, 'title' => 'Radar', 'order_index' => 1]);
        foreach ([['Princípios', 'text'], ['Alinhamento', 'video_upload'], ['Teste do radar', 'quiz']] as $i => [$title, $type]) {
            $this->lessons[] = Lesson::create(['module_id' => $module->id, 'title' => $title, 'content_type' => $type, 'duration_seconds' => 720, 'order_index' => $i]);
        }
        Enrollment::create(['user_id' => $this->student->id, 'course_id' => $this->course->id, 'enrolled_at' => now()]);
    }

    private function user(string $role): User
    {
        return User::factory()->create(['role_id' => Role::where('name', $role)->first()->id]);
    }

    public function test_the_dashboard_shows_real_progress_and_where_the_student_stopped(): void
    {
        LessonProgress::create(['user_id' => $this->student->id, 'lesson_id' => $this->lessons[0]->id, 'status' => 'completed', 'progress_percent' => 100]);
        LessonProgress::create(['user_id' => $this->student->id, 'lesson_id' => $this->lessons[1]->id, 'status' => 'in_progress', 'last_position_seconds' => 462]);

        $this->actingAs($this->student)->get('/dashboard')->assertInertia(fn ($page) => $page
            ->component('Dashboard')
            ->where('courses.0.pct', 33)
            ->where('courses.0.state', 'curso')
            ->where('resume.lesson', 'Alinhamento')
            ->where('resume.stamp', 'Paraste aos 7:42 de 12:00')
            ->where('resume.left', 2)
            ->missing('xp')
        );
    }

    public function test_a_student_without_courses_sees_empty_panels(): void
    {
        $this->actingAs($this->user('aluno'))->get('/dashboard')->assertOk()->assertInertia(fn ($page) => $page
            ->where('resume', null)
            ->has('courses', 0)
            ->has('suggestions', 1)
        );
    }

    public function test_pending_lists_tests_without_a_passing_grade_and_results_list_the_attempts(): void
    {
        $quiz = $this->quiz();
        $this->actingAs($this->student)->get('/dashboard')->assertInertia(fn ($page) => $page
            ->where('pending.0.title', 'Teste do radar')
            ->where('pending.0.cta', 'Fazer o teste')
            ->has('results', 0)
        );

        QuizAttempt::create([
            'user_id' => $this->student->id, 'quiz_id' => $quiz['id'], 'score' => 50, 'passed' => false,
            'answers' => [$quiz['question1'] => $quiz['right1'], $quiz['question2'] => $quiz['wrong2']], 'attempted_at' => now(),
        ]);

        $this->actingAs($this->student)->get('/plataforma/avaliacoes')->assertInertia(fn ($page) => $page
            ->component('Student/Assessments')
            ->where('results.0.score', 50)
            ->where('results.0.right', 1)
            ->where('results.0.review.0', 'Qual é o alcance do radar?')
            ->where('results.0.attempt', 1)
        );
        $this->actingAs($this->student)->get('/dashboard')->assertInertia(fn ($page) => $page->where('pending.0.cta', 'Tentar outra vez'));

        QuizAttempt::create(['user_id' => $this->student->id, 'quiz_id' => $quiz['id'], 'score' => 100, 'passed' => true, 'answers' => [], 'attempted_at' => now()]);
        $this->actingAs($this->student)->get('/dashboard')->assertInertia(fn ($page) => $page->has('pending', 0));
    }

    private function quiz(): array
    {
        $quiz = Quiz::create(['lesson_id' => $this->lessons[2]->id, 'title' => 'Teste do radar', 'passing_score' => 70]);
        $q1 = QuizQuestion::create(['quiz_id' => $quiz->id, 'question' => 'O que mede o radar?', 'order_index' => 0]);
        $q2 = QuizQuestion::create(['quiz_id' => $quiz->id, 'question' => 'Qual é o alcance do radar?', 'order_index' => 1]);
        $right1 = QuizOption::create(['question_id' => $q1->id, 'option_text' => 'Distância', 'is_correct' => true]);
        QuizOption::create(['question_id' => $q2->id, 'option_text' => '200 m', 'is_correct' => true]);
        $wrong2 = QuizOption::create(['question_id' => $q2->id, 'option_text' => '2 m', 'is_correct' => false]);

        return ['id' => $quiz->id, 'question1' => $q1->id, 'question2' => $q2->id, 'right1' => $right1->id, 'wrong2' => $wrong2->id];
    }

    public function test_documents_stay_available_after_access_ends(): void
    {
        $this->course->update(['access_months' => 1]);
        Enrollment::where('user_id', $this->student->id)->update(['enrolled_at' => now()->subYear()]);
        LessonAttachment::create(['lesson_id' => $this->lessons[0]->id, 'name' => 'Manual.pdf', 'path' => '/docs/manual.pdf', 'size' => 2000]);

        $this->actingAs($this->student)->get('/plataforma/documentos')->assertInertia(fn ($page) => $page
            ->component('Student/Documents')
            ->where('courses.0.count', 1)
            ->where('courses.0.sections.0.files.0.type', 'PDF')
            ->where('courses.0.sections.0.files.0.url', '/docs/manual.pdf')
        );
        $this->actingAs($this->student)->get('/dashboard')->assertInertia(fn ($page) => $page
            ->where('resume', null)
            ->where('courses.0.expired', true)
        );
    }

    public function test_notes_only_show_those_of_the_student(): void
    {
        LessonNote::create(['user_id' => $this->student->id, 'lesson_id' => $this->lessons[1]->id, 'position_seconds' => 312, 'body' => 'Confirmar o piso.']);
        LessonNote::create(['user_id' => $this->instructor->id, 'lesson_id' => $this->lessons[1]->id, 'position_seconds' => 1, 'body' => 'De outra pessoa.']);

        $this->actingAs($this->student)->get('/dashboard')->assertInertia(fn ($page) => $page
            ->has('notes', 1)
            ->where('notes.0.body', 'Confirmar o piso.')
            ->where('notes.0.at', '5:12')
        );
    }

    public function test_each_user_keeps_their_own_layout_and_can_reset_it(): void
    {
        $layout = ['items' => ['cursos' => ['x' => 2, 'y' => 0, 'w' => 6, 'h' => 10]], 'collapsed' => ['cursos'], 'hidden' => [], 'order' => ['cursos']];

        $this->actingAs($this->student)->putJson('/plataforma/paineis/home', $layout)->assertNoContent();

        $this->actingAs($this->student)->get('/dashboard')->assertInertia(fn ($page) => $page
            ->where('savedLayout.items.cursos.x', 2)
            ->where('savedLayout.collapsed.0', 'cursos')
            ->missing('auth.user.panel_layouts')
        );
        $this->actingAs($this->user('aluno'))->get('/dashboard')->assertInertia(fn ($page) => $page->where('savedLayout', null));

        $this->actingAs($this->student)->deleteJson('/plataforma/paineis/home')->assertNoContent();
        $this->assertNull($this->student->fresh()->panel_layouts);
    }

    public function test_invalid_layouts_are_refused(): void
    {
        $ok = ['collapsed' => [], 'hidden' => [], 'order' => []];

        $this->actingAs($this->student)->putJson('/plataforma/paineis/inventada', ['items' => ['a' => ['x' => 0, 'y' => 0, 'w' => 6, 'h' => 6]], ...$ok])->assertNotFound();
        $this->actingAs($this->student)->putJson('/plataforma/paineis/home', ['items' => ['cursos' => ['x' => 99, 'y' => 0, 'w' => 6, 'h' => 6]], ...$ok])->assertUnprocessable();
        $this->actingAs($this->student)->putJson('/plataforma/paineis/home', ['items' => ['<b>' => ['x' => 0, 'y' => 0, 'w' => 6, 'h' => 6]], ...$ok])->assertUnprocessable();
        $this->assertNull($this->student->fresh()->panel_layouts);
    }

    public function test_a_student_talks_with_the_instructor_and_only_they_see_it(): void
    {
        $this->actingAs($this->student)->post('/plataforma/mensagens', ['course_id' => $this->course->id, 'body' => 'Tenho uma dúvida.'])->assertRedirect();

        $this->actingAs($this->instructor)->get('/dashboard')->assertInertia(fn ($page) => $page
            ->where('messages.threads.0.name', $this->student->name)
            ->where('messages.threads.0.unread', 1)
        );
        $this->actingAs($this->instructor)->post('/plataforma/mensagens', ['course_id' => $this->course->id, 'student_id' => $this->student->id, 'body' => 'Diz.'])->assertRedirect();
        $this->actingAs($this->student)->post('/plataforma/mensagens/lidas', ['course_id' => $this->course->id, 'student_id' => $this->student->id])->assertRedirect();

        $this->actingAs($this->student)->get('/dashboard')->assertInertia(fn ($page) => $page
            ->where('messages.threads.0.name', $this->instructor->name)
            ->where('messages.threads.0.unread', 0)
            ->where('messages.threads.0.items.1.body', 'Diz.')
            ->has('messages.canStart', 0)
        );
        $this->actingAs($this->user('aluno'))->get('/dashboard')->assertInertia(fn ($page) => $page->has('messages.threads', 0));
    }

    public function test_messages_are_refused_to_anyone_outside_the_course(): void
    {
        $outsider = $this->user('aluno');
        $this->actingAs($outsider)->post('/plataforma/mensagens', ['course_id' => $this->course->id, 'body' => 'Olá'])->assertForbidden();
        $this->actingAs($outsider)->post('/plataforma/mensagens/lidas', ['course_id' => $this->course->id, 'student_id' => $this->student->id])->assertForbidden();
        // O formador só escreve a quem está inscrito
        $this->actingAs($this->instructor)->post('/plataforma/mensagens', ['course_id' => $this->course->id, 'student_id' => $outsider->id, 'body' => 'Olá'])->assertForbidden();
        $this->assertSame(0, CourseMessage::count());
    }

    public function test_the_enrolled_course_page_and_my_courses_open(): void
    {
        $this->actingAs($this->student)->get('/plataforma/meus-cursos')->assertInertia(fn ($page) => $page->component('Student/MyCourses')->has('courses', 1));
        $this->actingAs($this->student)->get('/plataforma/cursos/calibracao-adas')->assertOk()->assertInertia(fn ($page) => $page
            ->component('Learn/Course')
            ->where('access.mode', 'enrolled')
            ->where('savedLayout', null)
        );
    }

    public function test_a_student_without_courses_gets_the_welcome_with_real_courses(): void
    {
        $this->actingAs($this->user('aluno'))->get('/dashboard')->assertInertia(fn ($page) => $page
            ->has('courses', 0)
            ->has('pending', 0)
            ->has('messages.threads', 0)
            ->has('starter', 1)
            ->where('starter.0.title', 'Calibração de ADAS')
            ->where('starter.0.lessons', 3)
        );

        // Com um curso, deixa de ser o primeiro uso
        $this->actingAs($this->student)->get('/dashboard')->assertInertia(fn ($page) => $page->has('starter', 0));
    }

    public function test_unread_messages_and_assigned_courses_become_tasks_and_nav_counts(): void
    {
        CourseMessage::create(['course_id' => $this->course->id, 'student_id' => $this->student->id, 'sender_id' => $this->instructor->id, 'body' => 'Viste o vídeo do radar?']);
        Enrollment::where('user_id', $this->student->id)->update(['assigned_at' => now()]);

        $this->actingAs($this->student)->get('/dashboard')->assertInertia(fn ($page) => $page
            ->where('pending.0.kind', 'Mensagem')
            ->where('pending.0.url', '/dashboard?conversa='.$this->course->id.'-'.$this->student->id)
            ->where('pending.1.kind', 'Curso atribuído')
            ->where('pending.1.cta', 'Começar o curso')
            ->where('navCounts.home', 1)
            ->where('navCounts.mine', 1)
        );

        // Lida a mensagem e começado o curso, as tarefas e os números desaparecem
        CourseMessage::query()->update(['read_at' => now()]);
        LessonProgress::create(['user_id' => $this->student->id, 'lesson_id' => $this->lessons[0]->id, 'status' => 'completed', 'progress_percent' => 100]);
        $this->actingAs($this->student)->get('/dashboard')->assertInertia(fn ($page) => $page
            ->where('navCounts', [])
            ->has('pending', 0)
        );
    }

    public function test_the_certificates_page_shows_issued_and_coming_certificates(): void
    {
        // A caminho: 1 de 3 aulas feitas
        LessonProgress::create(['user_id' => $this->student->id, 'lesson_id' => $this->lessons[0]->id, 'status' => 'completed', 'progress_percent' => 100]);
        $this->actingAs($this->student)->get('/plataforma/certificados')->assertOk()->assertInertia(fn ($page) => $page
            ->component('Student/Certificates')
            ->has('issued', 0)
            ->where('coming.0.title', 'Calibração de ADAS')
            ->where('coming.0.progress', 33)
            ->where('coming.0.missing.0', 'Concluir 100% das aulas (tens 33%)'));

        \App\Models\Certificate::create(['user_id' => $this->student->id, 'course_id' => $this->course->id, 'certificate_number' => 'TA-2026-ABC123', 'status' => 'valid', 'issued_at' => now()]);
        $this->actingAs($this->student)->get('/plataforma/certificados')->assertInertia(fn ($page) => $page
            ->where('issued.0.number', 'TA-2026-ABC123')
            ->where('issued.0.title', 'Calibração de ADAS')
            ->has('coming', 0));
    }

    public function test_the_instructor_sees_attendance_waiting_for_confirmation(): void
    {
        $this->course->update(['requires_attendance' => true]);
        foreach ($this->lessons as $l) {
            LessonProgress::create(['user_id' => $this->student->id, 'lesson_id' => $l->id, 'status' => 'completed', 'progress_percent' => 100]);
        }

        // O Início do formador mostra a presença por confirmar no curso e no número da barra
        $this->actingAs($this->instructor)->get('/dashboard')->assertInertia(fn ($page) => $page
            ->component('Dashboard')
            ->where('teaching.0.attendance', 1)
            ->where('navCounts.builder', 1)
        );

        Enrollment::where('user_id', $this->student->id)->update(['attended_at' => now()]);
        $this->actingAs($this->instructor)->get('/dashboard')->assertInertia(fn ($page) => $page->missing('navCounts.builder'));
    }
}
