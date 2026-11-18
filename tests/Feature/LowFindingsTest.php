<?php

namespace Tests\Feature;

use App\Mail\PlatformMail;
use App\Models\Role;
use App\Models\User;
use App\Support\InviteLink;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

/** Auditoria de segurança, pontos de gravidade baixa e informativa (12 a 24). */
class LowFindingsTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role = 'aluno', array $attrs = []): User
    {
        return User::factory()->create(['role_id' => Role::firstOrCreate(['name' => $role])->id] + $attrs);
    }

    private function resetWith(User $u, string $token, bool $invite = false)
    {
        return $this->post('/reset-password', ['token' => $token, 'email' => $u->email, 'invite' => $invite,
            'password' => 'palavra-nova-1234', 'password_confirmation' => 'palavra-nova-1234']);
    }

    public function test_forgot_password_links_last_60_minutes_and_invites_3_days(): void
    {
        // Ponto 13
        $u = $this->user();
        $token = Password::broker('users')->createToken($u);
        $this->travel(61)->minutes();
        $this->resetWith($u, $token)->assertSessionHasErrors('email');

        $invited = $this->user();
        $url = InviteLink::url($invited);
        $this->assertStringContainsString('convite=1', $url);
        parse_str((string) parse_url($url, PHP_URL_QUERY), $q);
        $this->travel(2)->days();
        $this->resetWith($invited, basename((string) parse_url($url, PHP_URL_PATH)))->assertSessionHasErrors('email'); // sem "invite" não vale
        $this->resetWith($invited, basename((string) parse_url($url, PHP_URL_PATH)), true)->assertSessionHasNoErrors()->assertRedirect(route('login'));
    }

    public function test_changing_or_resetting_the_password_ends_the_other_sessions(): void
    {
        // Ponto 12
        $u = $this->user();
        foreach (['telemovel', 'outro-pc'] as $id) {
            DB::table('sessions')->insert(['id' => $id, 'user_id' => $u->id, 'payload' => '', 'last_activity' => time()]);
        }
        $this->actingAs($u)->put('/password', ['current_password' => 'password', 'password' => 'palavra-nova-1234', 'password_confirmation' => 'palavra-nova-1234'])
            ->assertSessionHasNoErrors();
        $this->assertSame(0, DB::table('sessions')->whereIn('id', ['telemovel', 'outro-pc'])->count());

        DB::table('sessions')->insert(['id' => 'ladrao', 'user_id' => $u->id, 'payload' => '', 'last_activity' => time()]);
        $this->app['auth']->forgetGuards(); // repor a palavra-passe é para quem está fora
        $this->resetWith($u, Password::broker('users')->createToken($u))->assertSessionHasNoErrors();
        $this->assertSame(0, DB::table('sessions')->where('user_id', $u->id)->count());
    }

    public function test_an_email_changed_by_staff_must_be_confirmed_and_the_old_one_is_told(): void
    {
        // Ponto 14
        Mail::fake();
        Notification::fake();
        $u = $this->user('aluno', ['email' => 'ana@oficina.pt']);

        $this->actingAs($this->user('admin'))->put("/administracao/pessoas/{$u->ulid}", ['name' => $u->name, 'email' => 'outro@exemplo.pt', 'role' => 'aluno'])
            ->assertRedirect()->assertSessionHasNoErrors();
        $this->assertNull($u->fresh()->email_verified_at);
        Notification::assertSentTo($u->fresh(), VerifyEmail::class);
        Mail::assertSent(PlatformMail::class, fn ($m) => $m->hasTo('ana@oficina.pt') && str_contains(implode(' ', $m->lines), 'outro@exemplo.pt'));

        // Mudar só o nome não pede confirmação
        $this->actingAs($this->user('admin'))->put("/administracao/pessoas/{$u->ulid}", ['name' => 'Ana M.', 'email' => 'outro@exemplo.pt', 'role' => 'aluno']);
        Notification::assertSentToTimes($u->fresh(), VerifyEmail::class, 1);
    }

    public function test_interrupted_video_uploads_cannot_fill_the_disk(): void
    {
        // Ponto 15
        $f = $this->user('formador');
        $other = $this->user('formador');
        $tmp = Storage::disk('local');
        foreach ([1, 2, 3] as $n) {
            $tmp->put("video-uploads/{$f->id}-a{$n}.part", 'x');
        }
        $tmp->put("video-uploads/{$other->id}-b.part", 'x');
        $start = fn () => $this->actingAs($f)->post('/formador/videos', ['id' => (string) Str::uuid(), 'index' => '0', 'total' => '2',
            'size' => '6000000', 'name' => 'a.mp4', 'chunk' => UploadedFile::fake()->createWithContent('chunk', 'x')], ['Accept' => 'application/json']);

        $start()->assertStatus(429);
        // Os interrompidos há mais de 24 h saem; os de outra pessoa ficam
        touch($tmp->path("video-uploads/{$f->id}-a1.part"), now()->subDays(2)->getTimestamp());
        $start()->assertStatus(200);
        $tmp->assertMissing("video-uploads/{$f->id}-a1.part");
        $tmp->assertExists("video-uploads/{$other->id}-b.part");
    }

    public function test_the_contact_form_has_a_daily_limit_per_email(): void
    {
        // Ponto 16
        Mail::fake();
        $send = fn () => $this->post('/plataforma/contactos', ['kind' => 'esclarecimento', 'type' => 'particular', 'name' => 'Ana', 'email' => 'spam@exemplo.pt',
            'message' => 'Olá, tenho uma dúvida sobre os cursos.', 'consent' => '1'], ['REMOTE_ADDR' => '10.0.0.'.random_int(1, 250)]);
        for ($i = 0; $i < 5; $i++) {
            $this->travel(2)->minutes();
            $send();
        }
        $this->travel(2)->minutes();
        $send()->assertSessionHasErrors('email');
    }

    public function test_only_the_routes_the_pages_use_are_sent_to_visitors(): void
    {
        // Ponto 21
        $html = $this->get('/login')->getContent();
        $this->assertStringContainsString('password.request', $html);
        $this->assertStringNotContainsString('administracao', $html);
        $this->assertStringNotContainsString('alex.webhook', $html);
    }

    public function test_a_password_typed_in_the_email_field_is_not_logged(): void
    {
        // Ponto 23
        \App\Support\ActivityRecorder::register();
        event(new \Illuminate\Auth\Events\Failed('web', null, ['email' => 'MinhaPalavraPasse!', 'password' => 'x']));
        $this->assertSame(0, \App\Models\ActivityLog::where('properties', 'like', '%MinhaPalavraPasse%')->count());
    }
}
