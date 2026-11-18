<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\AlexConversation;
use App\Models\Category;
use App\Models\Certificate;
use App\Models\ContactRequest;
use App\Models\Course;
use App\Models\CourseMessage;
use App\Models\Enrollment;
use App\Models\Lesson;
use App\Models\LessonNote;
use App\Models\LessonProgress;
use App\Models\Module;
use App\Models\Role;
use App\Models\User;
use App\Support\Activity;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/** Apagar a minha conta (RGPD, auditoria ponto 11) e o prazo das transcrições do Alex. */
class AccountErasureTest extends TestCase
{
    use RefreshDatabase;

    private Course $course;

    private Lesson $lesson;

    protected function setUp(): void
    {
        parent::setUp();
        foreach (['aluno', 'formador', 'admin', 'team_leader', 'gestor_cursos'] as $r) {
            Role::firstOrCreate(['name' => $r]);
        }
        $cat = Category::create(['slug' => 'mecanica', 'name' => 'Mecânica', 'color_hex' => '#F8B101']);
        $this->course = Course::create(['ulid' => (string) Str::ulid(), 'category_id' => $cat->id, 'title' => 'C', 'slug' => 'c',
            'level' => 'iniciante', 'status' => 'published', 'price' => 10]);
        $m = Module::create(['course_id' => $this->course->id, 'title' => 'M', 'order_index' => 0]);
        $this->lesson = Lesson::create(['module_id' => $m->id, 'title' => 'Texto', 'content_type' => 'text', 'body' => 'x', 'order_index' => 0]);
    }

    private function user(string $role = 'aluno', array $attrs = []): User
    {
        return User::factory()->create(['role_id' => Role::where('name', $role)->value('id')] + $attrs);
    }

    public function test_erasing_removes_the_personal_data_and_keeps_only_purchase_records(): void
    {
        $u = $this->user('aluno', ['name' => 'Rui Silva', 'email' => 'rui@oficina.pt', 'phone' => '912345678']);
        $other = $this->user();
        Enrollment::create(['user_id' => $u->id, 'course_id' => $this->course->id, 'source' => 'manual', 'enrolled_at' => now()]);
        LessonProgress::create(['user_id' => $u->id, 'lesson_id' => $this->lesson->id, 'status' => 'completed']);
        LessonNote::create(['user_id' => $u->id, 'lesson_id' => $this->lesson->id, 'position_seconds' => 1, 'body' => 'nota']);
        CourseMessage::create(['course_id' => $this->course->id, 'student_id' => $u->id, 'sender_id' => $u->id, 'body' => 'olá']);
        AlexConversation::create(['user_id' => $u->id, 'course_id' => $this->course->id, 'place' => 'aula', 'status' => 'ended', 'transcript' => [['role' => 'user', 'content' => 'x']]]);
        Certificate::create(['user_id' => $u->id, 'course_id' => $this->course->id, 'certificate_number' => 'TA-1', 'status' => 'valid', 'issued_at' => now()]);
        $purchase = ContactRequest::create(['kind' => 'compra', 'type' => 'particular', 'name' => 'Rui Silva', 'email' => 'rui@oficina.pt',
            'message' => 'Quero o curso', 'user_id' => $u->id, 'course_id' => $this->course->id, 'amount' => 10, 'status' => 'pago']);
        $question = ContactRequest::create(['kind' => 'esclarecimento', 'type' => 'particular', 'name' => 'Rui Silva', 'email' => 'rui@oficina.pt',
            'phone' => '912345678', 'message' => 'Uma dúvida pessoal', 'user_id' => $u->id, 'status' => 'novo']);
        Activity::log('conta.entrou', null, [], null, $u);
        // Dados de outra pessoa não se mexem
        LessonNote::create(['user_id' => $other->id, 'lesson_id' => $this->lesson->id, 'position_seconds' => 1, 'body' => 'outra']);

        $this->actingAs($u)->delete('/profile', ['password' => 'password'])->assertRedirect('/');
        $this->assertGuest();

        $u = User::withTrashed()->find($u->id);
        $this->assertTrue($u->trashed() && $u->isErased());
        $this->assertSame('Conta apagada', $u->name);
        $this->assertStringEndsWith('@conta-apagada.invalid', $u->email);
        $this->assertNull($u->phone);
        foreach ([Enrollment::class, LessonProgress::class, LessonNote::class, AlexConversation::class, Certificate::class] as $model) {
            $this->assertSame(0, $model::where('user_id', $u->id)->count(), $model);
        }
        $this->assertSame(0, CourseMessage::where('student_id', $u->id)->count());
        $this->assertSame(1, LessonNote::where('user_id', $other->id)->count());

        // A compra fica para a faturação; o pedido de esclarecimento perde os dados de contacto
        $this->assertSame('rui@oficina.pt', $purchase->fresh()->email);
        $question->refresh();
        $this->assertSame('Conta apagada', $question->name);
        $this->assertNull($question->phone);
        $this->assertSame('', $question->message);
        $this->assertStringNotContainsString('rui@oficina.pt', $question->email);

        // O registo de atividade fica sem o nome e sem o IP
        $this->assertSame(0, ActivityLog::where('user_name', 'Rui Silva')->count());
        $this->assertSame(0, ActivityLog::where('user_id', $u->id)->whereNotNull('ip')->count());

        // O email fica livre para uma conta nova
        $this->post('/register', ['name' => 'Rui Silva', 'email' => 'rui@oficina.pt', 'password' => 'outra-palavra-1', 'password_confirmation' => 'outra-palavra-1'])
            ->assertSessionHasNoErrors();
        $this->assertSame(1, User::where('email', 'rui@oficina.pt')->count());
    }

    public function test_an_erased_account_cannot_be_reactivated(): void
    {
        $u = $this->user();
        $this->actingAs($u)->delete('/profile', ['password' => 'password']);

        $this->actingAs($this->user('admin'))->post("/administracao/pessoas/{$u->id}/reativar")->assertSessionHasErrors('person');
        $this->assertTrue(User::withTrashed()->find($u->id)->trashed());
    }

    public function test_only_students_erase_their_own_account(): void
    {
        $formador = $this->user('formador');

        $this->actingAs($formador)->get('/definicoes')->assertInertia(fn ($p) => $p->where('canErase', false));
        $this->actingAs($formador)->delete('/profile', ['password' => 'password'])->assertForbidden();
        $this->assertFalse($formador->fresh()->trashed());

        $this->actingAs($this->user())->get('/definicoes')->assertInertia(fn ($p) => $p->where('canErase', true));
    }

    public function test_alex_transcripts_are_removed_after_90_days(): void
    {
        $u = $this->user();
        $old = AlexConversation::create(['user_id' => $u->id, 'course_id' => $this->course->id, 'place' => 'aula', 'status' => 'ended', 'transcript' => [['content' => 'antigo']]]);
        $old->forceFill(['created_at' => now()->subDays(91)])->save();
        $new = AlexConversation::create(['user_id' => $u->id, 'course_id' => $this->course->id, 'place' => 'aula', 'status' => 'ended', 'transcript' => [['content' => 'novo']]]);

        $this->assertSame(1, Activity::pruneTranscripts());
        $this->assertNull($old->fresh()->transcript);
        $this->assertNotNull($old->fresh()); // a conversa fica
        $this->assertNotNull($new->fresh()->transcript);
    }
}
