<?php

namespace Tests\Feature;

use App\Mail\PlatformMail;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/** Botão PT · EN: a língua fica na conta (ou no browser, antes de entrar) e os emails seguem a de quem os recebe. */
class LocaleTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        foreach (['aluno', 'formador', 'admin', 'team_leader', 'gestor_cursos'] as $r) {
            Role::firstOrCreate(['name' => $r]);
        }
    }

    private function user(array $attrs = []): User
    {
        return User::factory()->create(['role_id' => Role::where('name', 'aluno')->value('id'), ...$attrs]);
    }

    public function test_the_choice_is_saved_on_the_account_and_the_platform_answers_in_english(): void
    {
        $u = $this->user();
        $this->actingAs($u)->get('/dashboard')->assertInertia(fn ($p) => $p->where('locale', 'pt'));

        $this->actingAs($u)->from('/dashboard')->put('/lingua', ['locale' => 'en'])->assertRedirect('/dashboard');
        $this->assertSame('en', $u->fresh()->locale);

        $this->actingAs($u->fresh())->get('/dashboard')->assertInertia(fn ($p) => $p->where('locale', 'en'));
        $this->actingAs($u->fresh())->post('/logout')->assertSessionHas('status', 'Signed out. See you soon.');
    }

    public function test_only_portuguese_or_english_are_accepted(): void
    {
        $this->actingAs($this->user())->put('/lingua', ['locale' => 'fr'])->assertSessionHasErrors('locale');
    }

    public function test_before_signing_in_the_browser_language_decides_but_portuguese_wins(): void
    {
        $this->withHeader('Accept-Language', 'en-GB,en;q=0.9')->get('/')->assertInertia(fn ($p) => $p->where('locale', 'en'));
        // Muita gente tem o browser em inglês com o português na lista: fica em português
        $this->withHeader('Accept-Language', 'en-US,en;q=0.9,pt-PT;q=0.8')->get('/')->assertInertia(fn ($p) => $p->where('locale', 'pt'));
        // A escolha no botão (cookie) manda sobre o browser
        $this->withHeader('Accept-Language', 'pt-PT')->withUnencryptedCookie('lang', 'en')->get('/')->assertInertia(fn ($p) => $p->where('locale', 'en'));
    }

    public function test_emails_follow_the_language_of_who_receives_them(): void
    {
        Mail::fake();
        $en = $this->user(['locale' => 'en', 'name' => 'Ana Silva']);
        $pt = $this->user(['name' => 'Rui Costa']);

        // Quem carrega no botão está em português; cada email sai na língua de quem o recebe
        foreach ([$en, $pt] as $who) {
            PlatformMail::inLocaleOf($who, fn () => PlatformMail::deliver($who->email, new PlatformMail(
                subjectLine: __('Lembrete: :course', ['course' => 'OBD-II']),
                heading: __('Olá :name, o curso :course está à tua espera', ['name' => 'X', 'course' => 'OBD-II']),
            )));
        }
        $this->assertSame('pt', app()->getLocale());

        Mail::assertSent(PlatformMail::class, fn ($m) => $m->hasTo($en->email) && $m->subjectLine === 'Reminder: OBD-II');
        Mail::assertSent(PlatformMail::class, fn ($m) => $m->hasTo($pt->email) && $m->subjectLine === 'Lembrete: OBD-II');
    }

    public function test_every_translation_keeps_its_variables(): void
    {
        $en = json_decode(file_get_contents(lang_path('en.json')), true);
        $vars = fn ($s) => collect(preg_match_all('/:[A-Za-z_]\w*/', $s, $m) ? $m[0] : [])->sort()->values()->all();
        foreach ($en as $pt => $text) {
            $this->assertSame($vars($pt), $vars($text), "Variáveis diferentes em: {$pt}");
        }
    }
}
