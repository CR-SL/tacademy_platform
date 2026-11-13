<?php

namespace Tests\Feature;

use App\Models\AlexConversation;
use App\Models\Category;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Lesson;
use App\Models\Module;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

/** O Alex pela API do Tavus: onde aparece, quem pode falar, limites, fim da conversa e avisos do Tavus. */
class AlexTest extends TestCase
{
    use RefreshDatabase;

    private Course $diag;

    private Course $other;

    protected function setUp(): void
    {
        parent::setUp();
        foreach (['aluno', 'formador', 'admin', 'team_leader', 'gestor_cursos'] as $r) {
            Role::firstOrCreate(['name' => $r]);
        }
        config([
            'services.tavus.api_key' => 'test-key',
            'services.tavus.base_url' => 'https://tavus.test',
            'services.tavus.pal_id' => 'p-alex',
            'services.tavus.face_id' => 'r-face',
            'services.tavus.minutes' => 15,
            'services.tavus.per_day' => 3,
        ]);
        $this->diag = $this->course('Diagnóstico Automóvel', 'diagnostico-automovel');
        $this->diag->update(['alex_enabled' => true]);
        $this->other = $this->course('Gestão de Oficina', 'gestao-oficina');
        Http::fake([
            'tavus.test/v2/conversations' => Http::sequence()
                ->push(['conversation_id' => 'c1', 'conversation_url' => 'https://tavus.daily.co/c1', 'meeting_token' => 'tok1', 'status' => 'active'])
                ->push(['conversation_id' => 'c2', 'conversation_url' => 'https://tavus.daily.co/c2', 'meeting_token' => 'tok2', 'status' => 'active'])
                ->push(['conversation_id' => 'c3', 'conversation_url' => 'https://tavus.daily.co/c3', 'meeting_token' => 'tok3', 'status' => 'active'])
                ->push(['conversation_id' => 'c4', 'conversation_url' => 'https://tavus.daily.co/c4', 'meeting_token' => 'tok4', 'status' => 'active']),
            'tavus.test/v2/conversations/*/end' => Http::response(null, 200),
        ]);
    }

    private function course(string $title, string $slug): Course
    {
        $cat = Category::firstOrCreate(['slug' => 'diagnostico'], ['name' => 'Diagnóstico Automóvel', 'color_hex' => '#F8B101']);
        $c = Course::create([
            'ulid' => (string) Str::ulid(), 'category_id' => $cat->id, 'title' => $title, 'slug' => $slug,
            'level' => 'iniciante', 'status' => 'published', 'price' => 49,
        ]);
        $m = Module::create(['course_id' => $c->id, 'title' => 'Módulo 4 · AVAC', 'order_index' => 0]);
        Lesson::create(['module_id' => $m->id, 'title' => 'Fugas de gás', 'content_type' => 'text', 'body' => 'Olá', 'duration_seconds' => 60, 'order_index' => 0]);

        return $c;
    }

    private function student(Course ...$courses): User
    {
        $u = User::factory()->create(['name' => 'Ana Martins', 'role_id' => Role::where('name', 'aluno')->value('id')]);
        foreach ($courses as $c) {
            Enrollment::create(['user_id' => $u->id, 'course_id' => $c->id, 'source' => 'manual', 'enrolled_at' => now()]);
        }

        return $u;
    }

    private function lessonOf(Course $c): Lesson
    {
        return $c->lessons()->first();
    }

    public function test_the_alex_shows_on_home_assessments_and_lessons_of_his_course(): void
    {
        $u = $this->student($this->diag, $this->other);

        $this->actingAs($u)->get('/dashboard')->assertInertia(fn ($p) => $p->where('alex.place', 'inicio')->where('alex.left', 3)->where('alex.minutes', 15));
        $this->actingAs($u)->get('/plataforma/avaliacoes')->assertInertia(fn ($p) => $p->where('alex.place', 'avaliacoes'));
        $lesson = $this->lessonOf($this->diag);
        $this->actingAs($u)->get("/plataforma/cursos/{$this->diag->slug}/aulas/{$lesson->ulid}")
            ->assertInertia(fn ($p) => $p->where('alex.place', 'aula')->where('alex.lesson', $lesson->ulid));

        // Noutros cursos e noutras páginas não aparece
        $other = $this->lessonOf($this->other);
        $this->actingAs($u)->get("/plataforma/cursos/{$this->other->slug}/aulas/{$other->ulid}")->assertInertia(fn ($p) => $p->where('alex', null));
        $this->actingAs($u)->get('/plataforma/meus-cursos')->assertInertia(fn ($p) => $p->where('alex', ['place' => null]));
    }

    public function test_students_without_the_course_or_without_a_key_do_not_get_the_alex(): void
    {
        $outsider = $this->student($this->other);
        $this->actingAs($outsider)->get('/dashboard')->assertInertia(fn ($p) => $p->where('alex', null));
        $this->actingAs($outsider)->get('/plataforma/meus-cursos')->assertInertia(fn ($p) => $p->where('alex', null));
        $this->actingAs($outsider)->postJson('/plataforma/alex/conversas', ['place' => 'inicio'])->assertForbidden();
        $lesson = $this->lessonOf($this->diag);
        $this->actingAs($outsider)->postJson('/plataforma/alex/conversas', ['place' => 'aula', 'lesson' => $lesson->ulid])->assertForbidden();

        config(['services.tavus.api_key' => null]);
        $this->actingAs($this->student($this->diag))->get('/dashboard')->assertInertia(fn ($p) => $p->where('alex', null));
        Http::assertNothingSent();
    }

    public function test_starting_creates_a_private_room_with_who_the_student_is(): void
    {
        $u = $this->student($this->diag);
        $lesson = $this->lessonOf($this->diag);

        $res = $this->actingAs($u)->postJson('/plataforma/alex/conversas', ['place' => 'aula', 'lesson' => $lesson->ulid])
            ->assertCreated()
            ->assertJsonPath('url', 'https://tavus.daily.co/c1')
            ->assertJsonPath('token', 'tok1')
            ->assertJsonPath('left', 2);
        $this->assertNotNull($res->json('endsAt'));

        Http::assertSent(function (HttpRequest $r) use ($u) {
            if ($r->url() !== 'https://tavus.test/v2/conversations') {
                return false;
            }
            $d = $r->data();

            return $r->hasHeader('x-api-key', 'test-key')
                && $d['pal_id'] === 'p-alex' && $d['face_id'] === 'r-face'
                && $d['require_auth'] === true
                && $d['participant_tags'] === ['tacademy-'.$u->ulid]
                && $d['properties']['max_call_duration'] === 900
                && $d['properties']['languages'] === ['pt']
                && str_contains($d['conversational_context'], 'Ana Martins')
                && str_contains($d['conversational_context'], 'Fugas de gás')
                && str_contains($d['custom_greeting'], 'Olá Ana');
        });

        $c = AlexConversation::first();
        $this->assertSame(['active', 'c1', 'aula', $this->diag->id], [$c->status, $c->tavus_id, $c->place, $c->course_id]);
    }

    public function test_only_one_conversation_at_a_time_and_three_per_day(): void
    {
        $u = $this->student($this->diag);
        $this->actingAs($u)->postJson('/plataforma/alex/conversas', ['place' => 'inicio'])->assertCreated();
        // A segunda fecha a primeira no Tavus
        $this->actingAs($u)->postJson('/plataforma/alex/conversas', ['place' => 'avaliacoes'])->assertCreated();
        Http::assertSent(fn (HttpRequest $r) => $r->url() === 'https://tavus.test/v2/conversations/c1/end');
        $this->assertSame('ended', AlexConversation::where('tavus_id', 'c1')->value('status'));

        $this->actingAs($u)->postJson('/plataforma/alex/conversas', ['place' => 'inicio'])->assertCreated()->assertJsonPath('left', 0);
        $this->actingAs($u)->postJson('/plataforma/alex/conversas', ['place' => 'inicio'])->assertStatus(429)->assertJsonPath('left', 0);
        $this->assertSame(3, AlexConversation::count());

        // No dia seguinte volta a ter 3
        $this->travel(1)->days();
        $this->actingAs($u)->get('/dashboard')->assertInertia(fn ($p) => $p->where('alex.left', 3));
    }

    public function test_the_student_ends_only_his_own_conversation(): void
    {
        $u = $this->student($this->diag);
        $id = $this->actingAs($u)->postJson('/plataforma/alex/conversas', ['place' => 'inicio'])->json('id');

        $this->actingAs($this->student($this->diag))->postJson("/plataforma/alex/conversas/{$id}/terminar")->assertForbidden();
        $this->actingAs($u)->postJson("/plataforma/alex/conversas/{$id}/terminar")->assertOk()->assertJsonPath('left', 2);

        $c = AlexConversation::first();
        $this->assertSame('ended', $c->status);
        $this->assertNotNull($c->ended_at);
        Http::assertSent(fn (HttpRequest $r) => $r->url() === 'https://tavus.test/v2/conversations/c1/end');
    }

    public function test_a_tavus_failure_does_not_spend_a_conversation(): void
    {
        Http::swap(new \Illuminate\Http\Client\Factory); // sem o Tavus de faz de conta do setUp
        Http::fake(['tavus.test/*' => Http::response(['message' => 'boom'], 500)]);
        $u = $this->student($this->diag);

        $this->actingAs($u)->postJson('/plataforma/alex/conversas', ['place' => 'inicio'])->assertStatus(503);
        $this->assertSame('failed', AlexConversation::value('status'));
        $this->actingAs($u)->get('/dashboard')->assertInertia(fn ($p) => $p->where('alex.left', 3));
    }

    public function test_tavus_callbacks_must_be_signed_and_close_the_conversation(): void
    {
        $u = $this->student($this->diag);
        $this->actingAs($u)->postJson('/plataforma/alex/conversas', ['place' => 'inicio']);
        $secret = hash_hmac('sha256', 'tavus-callback', config('app.key'));
        $send = function (array $event, ?string $sig = null) use ($secret) {
            $body = json_encode($event);

            return $this->call('POST', '/webhooks/tavus', [], [], [], [
                'CONTENT_TYPE' => 'application/json',
                'HTTP_X_TAVUS_SIGNATURE' => $sig ?? hash_hmac('sha256', $body, $secret),
            ], $body);
        };

        $send(['conversation_id' => 'c1', 'event_type' => 'system.shutdown'], 'assinatura-falsa')->assertUnauthorized();
        $this->assertSame('active', AlexConversation::value('status'));

        $send(['conversation_id' => 'c1', 'event_type' => 'system.shutdown', 'properties' => ['shutdown_reason' => 'max_call_duration reached']])->assertNoContent();
        $send(['conversation_id' => 'c1', 'event_type' => 'application.transcription_ready', 'properties' => ['transcript' => [['role' => 'user', 'content' => 'Olá']]]])->assertNoContent();

        $c = AlexConversation::first();
        $this->assertSame(['ended', 'max_call_duration reached'], [$c->status, $c->end_reason]);
        $this->assertSame('Olá', $c->transcript[0]['content']);
    }

    public function test_each_course_can_have_its_own_alex(): void
    {
        $this->other->update(['alex_enabled' => true, 'alex_pal_id' => 'p-oficina']);
        $u = $this->student($this->diag, $this->other);
        // Inscrição mais recente: Gestão de Oficina (com o seu próprio Alex)
        Enrollment::where('user_id', $u->id)->where('course_id', $this->other->id)->update(['enrolled_at' => now()->addMinute()]);

        $this->actingAs($u)->postJson('/plataforma/alex/conversas', ['place' => 'inicio'])->assertCreated();
        Http::assertSent(fn (HttpRequest $r) => $r->url() === 'https://tavus.test/v2/conversations'
            && $r->data()['pal_id'] === 'p-oficina' && ! isset($r->data()['face_id']));

        // Na aula do Diagnóstico fala o Alex geral, com o rosto geral
        $lesson = $this->lessonOf($this->diag);
        $this->actingAs($u)->postJson('/plataforma/alex/conversas', ['place' => 'aula', 'lesson' => $lesson->ulid])->assertCreated();
        Http::assertSent(fn (HttpRequest $r) => $r->url() === 'https://tavus.test/v2/conversations'
            && $r->data()['pal_id'] === 'p-alex' && ($r->data()['face_id'] ?? null) === 'r-face');

        // Sem o Alex ligado, o curso deixa de o ter
        $this->diag->update(['alex_enabled' => false]);
        $this->actingAs($u)->get("/plataforma/cursos/{$this->diag->slug}/aulas/{$lesson->ulid}")->assertInertia(fn ($p) => $p->where('alex', null));
    }
}
