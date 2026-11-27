<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Lesson;
use App\Models\Module;
use App\Models\Role;
use App\Models\User;
use App\Support\CourseFiles;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

/** Vídeos e anexos dos cursos: só para quem pode abrir a aula (auditoria de segurança, ponto 2). */
class MediaTest extends TestCase
{
    use RefreshDatabase;

    private Course $course;

    private Lesson $lesson;

    private User $formador;

    private const VIDEO = 'cursos/videos/01aula.mp4';

    private const PDF = 'cursos/anexos/u1/esquema.pdf';

    protected function setUp(): void
    {
        parent::setUp();
        foreach (['aluno', 'formador', 'admin', 'team_leader', 'gestor_cursos'] as $r) {
            Role::firstOrCreate(['name' => $r]);
        }
        $this->formador = $this->user('formador');
        $cat = Category::create(['slug' => 'mecanica', 'name' => 'Mecânica', 'color_hex' => '#F8B101']);
        $this->course = Course::create([
            'ulid' => (string) Str::ulid(), 'category_id' => $cat->id, 'title' => 'Curso pago', 'slug' => 'curso-pago',
            'level' => 'iniciante', 'status' => 'published', 'price' => 49, 'instructor_id' => $this->formador->id,
        ]);
        $m = Module::create(['course_id' => $this->course->id, 'title' => 'Módulo 1', 'order_index' => 0]);
        $this->lesson = Lesson::create(['module_id' => $m->id, 'title' => 'Vídeo', 'content_type' => 'video_upload',
            'content_url' => '/storage/'.self::VIDEO, 'duration_seconds' => 100, 'order_index' => 0]);
        $this->lesson->attachments()->create(['name' => 'Esquema elétrico.pdf', 'path' => self::PDF, 'size' => 8, 'order_index' => 0]);

        CourseFiles::disk()->put(self::VIDEO, str_repeat('v', 1000));
        CourseFiles::disk()->put(self::PDF, '%PDF-1.4');
    }

    private function user(string $role = 'aluno'): User
    {
        return User::factory()->create(['role_id' => Role::where('name', $role)->value('id')]);
    }

    private function enrolled(?\DateTimeInterface $at = null): User
    {
        $u = $this->user();
        Enrollment::create(['user_id' => $u->id, 'course_id' => $this->course->id, 'source' => 'manual', 'enrolled_at' => $at ?? now()]);

        return $u;
    }

    public function test_an_enrolled_student_gets_the_video_and_can_seek(): void
    {
        $u = $this->enrolled();

        $this->actingAs($u)->get('/storage/'.self::VIDEO)->assertOk()->assertHeader('Cache-Control', 'max-age=3600, private');
        // Avançar no vídeo: pedido de um pedaço
        $this->actingAs($u)->get('/storage/'.self::VIDEO, ['Range' => 'bytes=100-199'])
            ->assertStatus(206)->assertHeader('Content-Range', 'bytes 100-199/1000');
        // O anexo abre no browser com o nome dado pelo formador
        $disposition = $this->actingAs($u)->get('/storage/'.self::PDF)->assertOk()->headers->get('Content-Disposition');
        $this->assertStringStartsWith('inline;', $disposition);
        $this->assertStringContainsString("utf-8''Esquema%20el%C3%A9trico.pdf", $disposition);
    }

    public function test_without_access_the_files_do_not_open(): void
    {
        // Sem sessão: vai para a entrada
        $this->get('/storage/'.self::VIDEO)->assertRedirect('/login');

        // Sem compra, ou com o acesso expirado: não existe (404)
        $this->actingAs($this->user())->get('/storage/'.self::VIDEO)->assertNotFound();
        $this->actingAs($this->user())->get('/storage/'.self::PDF)->assertNotFound();
        $this->course->update(['access_months' => 12]);
        $expired = $this->enrolled(now()->subMonths(13));
        $this->actingAs($expired)->get('/storage/'.self::VIDEO)->assertNotFound();

        // Outro formador também não
        $this->actingAs($this->user('formador'))->get('/storage/'.self::VIDEO)->assertNotFound();
    }

    public function test_the_instructor_opens_but_not_who_is_not_enrolled(): void
    {
        $this->actingAs($this->formador)->get('/storage/'.self::VIDEO)->assertOk();

        // Sem aula de amostra (2026-11-26): quem não está inscrito não abre o vídeo
        $this->actingAs($this->user())->get('/storage/'.self::VIDEO)->assertNotFound();
    }

    public function test_a_file_just_uploaded_in_the_editor_opens_only_for_its_uploader(): void
    {
        $mine = 'cursos/anexos/u'.$this->formador->id.'/novo.pdf';
        CourseFiles::disk()->put($mine, '%PDF-1.4');
        CourseFiles::disk()->put('cursos/videos/novo.mp4', 'v');

        $this->actingAs($this->formador)->get('/storage/'.$mine)->assertOk();
        $this->actingAs($this->formador)->get('/storage/cursos/videos/novo.mp4')->assertOk();
        $this->actingAs($this->user('formador'))->get('/storage/'.$mine)->assertNotFound();
        $this->actingAs($this->user())->get('/storage/cursos/videos/novo.mp4')->assertNotFound();
        $this->actingAs($this->formador)->get('/storage/cursos/anexos/u'.$this->formador->id.'/../u1/esquema.pdf')->assertNotFound();
    }

    public function test_on_railway_files_stay_in_the_public_volume(): void
    {
        // No Railway só a pasta pública sobrevive aos deploys: a proteção fica desligada e nada vai para a privada
        config(['tacademy.private_files' => false]);
        $doc = $this->actingAs($this->formador)->post('/formador/uploads', [
            'kind' => 'attachment', 'file' => \Illuminate\Http\UploadedFile::fake()->create('esquema.pdf', 20, 'application/pdf'),
        ])->assertOk()->json();
        Storage::disk('public')->assertExists($doc['path']);
        Storage::disk('local')->assertMissing($doc['path']);

        $this->artisan('files:make-private --force')->assertFailed();
    }

    public function test_old_files_still_open_until_they_are_made_private(): void
    {
        // Um ficheiro ainda no disco public (carregado antes) também é entregue pela app a quem tem acesso
        CourseFiles::disk()->delete(self::VIDEO);
        Storage::disk('public')->put(self::VIDEO, str_repeat('v', 1000));
        Storage::disk('public')->put('cursos/capas/capa.jpg', 'jpg');
        $u = $this->enrolled();
        $this->actingAs($u)->get('/storage/'.self::VIDEO)->assertOk();

        // Sem --force só lista; com --force passa para o privado e tira do public (as capas ficam)
        $this->artisan('files:make-private')->expectsOutputToContain(self::VIDEO)->assertSuccessful();
        Storage::disk('public')->assertExists(self::VIDEO);
        $this->artisan('files:make-private --force')->assertSuccessful();
        Storage::disk('public')->assertMissing(self::VIDEO);
        Storage::disk('public')->assertExists('cursos/capas/capa.jpg');
        $this->assertSame(1000, CourseFiles::disk()->size(self::VIDEO));
        $this->actingAs($u)->get('/storage/'.self::VIDEO)->assertOk();
    }
}
