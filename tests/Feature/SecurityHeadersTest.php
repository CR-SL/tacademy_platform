<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Lesson;
use App\Models\Module;
use App\Models\Role;
use App\Models\User;
use App\Services\CourseBuilder;
use App\Support\CourseFiles;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Tests\TestCase;

/** Cabeçalhos de segurança (auditoria, ponto 9) e sites aceites no avatar (ponto 8). */
class SecurityHeadersTest extends TestCase
{
    use RefreshDatabase;

    public function test_pages_carry_the_security_headers_and_the_nonce_matches_the_scripts(): void
    {
        $res = $this->get('/login')->assertOk()
            ->assertHeader('X-Frame-Options', 'SAMEORIGIN')
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

        // Sempre aplicado: ninguém mostra a plataforma num iframe de outro site; só os sites de vídeo e avatar em iframes
        $base = $res->headers->get('Content-Security-Policy');
        $this->assertStringContainsString("frame-ancestors 'self'", $base);
        $this->assertStringContainsString("object-src 'none'", $base);
        $this->assertStringContainsString('https://player.vimeo.com', $base);
        $this->assertStringContainsString('https://*.daily.co', $base);

        // A completa só reporta, e o nonce é o mesmo dos scripts da página
        $full = $res->headers->get('Content-Security-Policy-Report-Only');
        $this->assertMatchesRegularExpression("/script-src 'nonce-([^']+)'/", $full);
        preg_match("/'nonce-([^']+)'/", $full, $m);
        $this->assertStringContainsString('nonce="'.$m[1].'"', $res->getContent());

        // Com CSP_ENFORCE passa a ser aplicada
        config(['tacademy.csp_enforce' => true]);
        $this->assertStringContainsString('script-src', $this->get('/login')->headers->get('Content-Security-Policy'));
    }

    public function test_hsts_only_over_https(): void
    {
        $this->get('/login')->assertHeaderMissing('Strict-Transport-Security');
        $this->get('https://localhost/login')->assertHeader('Strict-Transport-Security', 'max-age=31536000');
    }

    public function test_files_from_the_app_have_no_csp_so_the_pdf_viewer_works(): void
    {
        foreach (['aluno', 'formador'] as $r) Role::firstOrCreate(['name' => $r]);
        $u = User::factory()->create(['role_id' => Role::where('name', 'formador')->value('id')]);
        CourseFiles::disk()->put('cursos/anexos/u'.$u->id.'/a.pdf', '%PDF-1.4');

        $this->actingAs($u)->get('/storage/cursos/anexos/u'.$u->id.'/a.pdf')->assertOk()
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeaderMissing('Content-Security-Policy');
    }

    public function test_csp_reports_are_logged_without_a_session(): void
    {
        Log::spy();
        $this->call('POST', '/csp-report', [], [], [], ['CONTENT_TYPE' => 'application/csp-report'], json_encode(['csp-report' => [
            'document-uri' => 'https://x/plataforma', 'violated-directive' => 'script-src', 'blocked-uri' => 'https://evil.example/a.js',
        ]]))->assertNoContent();
        Log::shouldHaveReceived('warning')->withArgs(fn ($msg, $ctx) => $msg === 'CSP' && $ctx['blocked'] === 'https://evil.example/a.js');
    }
}
