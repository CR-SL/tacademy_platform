<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Course;
use App\Models\Role;
use App\Models\User;
use App\Services\CourseBuilder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class CourseBuilderTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role): User
    {
        return User::factory()->create(['role_id' => Role::firstOrCreate(['name' => $role])->id]);
    }

    private function category(): Category
    {
        return Category::firstOrCreate(['slug' => 'diagnostico-automovel'], ['name' => 'Diagnóstico Automóvel', 'color_hex' => '#F8B101']);
    }

    /** PNG verdadeira de 1×1 (o PHP local pode não ter GD para gerar imagens falsas). */
    private function png(): UploadedFile
    {
        return UploadedFile::fake()->createWithContent('capa.png', base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
        ));
    }

    /** Estado do editor de um curso completo, pronto a publicar. */
    private function payload(array $override = []): array
    {
        return array_merge([
            'title' => 'Sistemas de Injeção Common Rail',
            'category_id' => $this->category()->id,
            'level' => 'avancado',
            'thumbnail_url' => '/images/cursos/cta-motor.jpg',
            'short_description' => 'Diagnóstico de sistemas diesel de alta pressão.',
            'description' => 'Curso prático.',
            'learning_outcomes' => ['Testar injetores', ''],
            'prerequisites' => 'OBD-II',
            'audience' => 'Mecânicos',
            'is_free' => false,
            'price' => '79.90',
            'access_months' => 12,
            'unlock_window' => 3,
            'certificate_enabled' => true,
            'certificate_min_progress' => 100,
            'certificate_min_score' => 70,
            'sample_lesson_key' => 'nB',
            'modules' => [[
                'key' => 'nA', 'id' => null, 'title' => 'Como funciona', 'description' => '',
                'lessons' => [
                    ['key' => 'nB', 'id' => null, 'title' => 'Introdução', 'type' => 'video_link', 'url' => 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'minutes' => 12, 'body' => '', 'attachments' => [], 'quiz' => [], 'checks' => [
                        ['question' => 'O que é o common rail?', 'options' => ['Um coletor de alta pressão', 'Um filtro', ''], 'correct' => 0, 'explanation' => 'Alimenta todos os injetores.'],
                        ['question' => '', 'options' => ['a', 'b'], 'correct' => 0, 'explanation' => ''],
                    ]],
                    ['key' => 'nC', 'id' => null, 'title' => 'Pergunta ao avatar', 'type' => 'avatar', 'url' => 'https://avatar.exemplo.pt/s/1', 'minutes' => 8, 'body' => '', 'attachments' => [], 'quiz' => []],
                    ['key' => 'nD', 'id' => null, 'title' => 'Teste', 'type' => 'quiz', 'url' => '', 'minutes' => 5, 'body' => '', 'attachments' => [], 'quiz' => [
                        ['question' => 'Pressão em ralenti?', 'options' => ['50 bar', '300 bar'], 'correct' => 1],
                    ]],
                ],
            ]],
        ], $override);
    }

    public function test_only_instructors_and_admins_can_open_my_courses(): void
    {
        $this->actingAs($this->user('aluno'))->get('/formador/cursos')->assertForbidden();
        $this->actingAs($this->user('formador'))->get('/formador/cursos')->assertOk();
        $this->actingAs($this->user('admin'))->get('/formador/cursos')->assertOk();
    }

    public function test_the_role_is_shared_with_the_navbar(): void
    {
        $this->actingAs($this->user('formador'))->get('/dashboard')
            ->assertInertia(fn ($page) => $page->where('auth.role', 'formador'));
    }

    public function test_an_instructor_creates_a_draft_with_modules_lessons_and_quiz(): void
    {
        $formador = $this->user('formador');

        $res = $this->actingAs($formador)->postJson('/formador/cursos', $this->payload())->assertCreated();

        $course = Course::firstOrFail();
        $this->assertSame('draft', $course->status);
        $this->assertSame($formador->id, $course->instructor_id);
        $this->assertSame('sistemas-de-injecao-common-rail', $course->slug);
        $this->assertSame(25, $course->duration_minutes);
        $this->assertSame(['Testar injetores'], $course->learning_outcomes);
        $this->assertCount(3, $course->lessons);
        $this->assertSame('https://avatar.exemplo.pt/s/1', $course->lessons()->where('content_type', 'avatar')->value('avatar_ref'));
        $this->assertSame($res->json('lessons.nB'), $course->sample_lesson_id);

        $this->assertSame(3, $course->unlock_window);
        // Perguntas rápidas do vídeo: as vazias são ignoradas e as opções vazias retiradas
        $checks = $course->lessons()->where('content_type', 'video_link')->first()->checks;
        $this->assertCount(1, $checks);
        $this->assertSame(['Um coletor de alta pressão', 'Um filtro'], $checks->first()->options);
        $this->assertSame('Alimenta todos os injetores.', $checks->first()->explanation);

        $quiz = $course->lessons()->where('content_type', 'quiz')->first()->quiz;
        $this->assertSame('300 bar', $quiz->questions->first()->options->firstWhere('is_correct', true)->option_text);
    }

    public function test_saving_again_updates_by_id_and_removes_deleted_lessons(): void
    {
        $formador = $this->user('formador');
        $res = $this->actingAs($formador)->postJson('/formador/cursos', $this->payload())->json();
        $course = Course::firstOrFail();

        $data = $this->payload(['title' => 'Common Rail na Prática']);
        $data['modules'][0]['id'] = $res['modules']['nA'];
        $data['modules'][0]['lessons'][0]['id'] = $res['lessons']['nB'];
        $data['modules'][0]['lessons'][0]['title'] = 'Introdução ao sistema';
        array_splice($data['modules'][0]['lessons'], 1, 2); // apaga o avatar e o quiz

        $this->actingAs($formador)->putJson("/formador/cursos/{$course->ulid}", $data)->assertOk();

        $course->refresh();
        $this->assertSame('common-rail-na-pratica', $course->slug);
        $this->assertSame(['Introdução ao sistema'], $course->lessons()->pluck('lessons.title')->all());
        $this->assertSame($res['lessons']['nB'], $course->lessons()->value('lessons.id'));
    }

    public function test_an_instructor_cannot_edit_someone_elses_course_but_an_admin_can(): void
    {
        $this->actingAs($this->user('formador'))->postJson('/formador/cursos', $this->payload());
        $course = Course::firstOrFail();

        $this->actingAs($this->user('formador'))->putJson("/formador/cursos/{$course->ulid}", $this->payload())->assertForbidden();
        $this->actingAs($this->user('formador'))->get("/formador/cursos/{$course->ulid}/editar")->assertForbidden();
        $this->actingAs($this->user('admin'))->putJson("/formador/cursos/{$course->ulid}", $this->payload())->assertOk();
    }

    public function test_an_incomplete_course_cannot_be_published(): void
    {
        $formador = $this->user('formador');
        $this->actingAs($formador)->postJson('/formador/cursos', $this->payload(['thumbnail_url' => null, 'price' => '']));
        $course = Course::firstOrFail();

        $this->actingAs($formador)->post("/formador/cursos/{$course->ulid}/publicar")
            ->assertSessionHasErrors('publish');
        $this->assertSame('draft', $course->fresh()->status);
    }

    public function test_a_published_course_appears_in_the_public_catalog(): void
    {
        $formador = $this->user('formador');
        $this->actingAs($formador)->postJson('/formador/cursos', $this->payload());
        $course = Course::firstOrFail();

        $this->get('/cursos')->assertDontSee('Sistemas de Injeção Common Rail');

        $this->actingAs($formador)->post("/formador/cursos/{$course->ulid}/publicar")
            ->assertRedirect('/formador/cursos');

        $this->assertSame('published', $course->fresh()->status);
        $this->get('/cursos')->assertSee('Sistemas de Injeção Common Rail');
    }

    public function test_the_cover_must_come_from_the_library_or_an_upload(): void
    {
        $this->actingAs($this->user('formador'))
            ->postJson('/formador/cursos', $this->payload(['thumbnail_url' => 'https://example.com/x.jpg']))
            ->assertJsonValidationErrors('thumbnail_url');
    }

    public function test_covers_and_attachments_are_uploaded_to_public_storage(): void
    {
        Storage::fake('public');
        $formador = $this->user('formador');

        $cover = $this->actingAs($formador)->post('/formador/uploads', [
            'kind' => 'cover', 'file' => $this->png(),
        ])->assertOk()->json();
        Storage::disk('public')->assertExists($cover['path']);
        $this->assertStringStartsWith('/storage/cursos/capas/', $cover['url']);

        $doc = $this->actingAs($formador)->post('/formador/uploads', [
            'kind' => 'attachment', 'file' => UploadedFile::fake()->create('esquema.pdf', 200, 'application/pdf'),
        ])->assertOk()->json();

        $data = $this->payload(['thumbnail_url' => $cover['url']]);
        $data['modules'][0]['lessons'][0]['attachments'] = [['name' => 'esquema.pdf', 'path' => $doc['path']]];
        $this->actingAs($formador)->postJson('/formador/cursos', $data)->assertCreated();

        $this->assertSame('esquema.pdf', Course::firstOrFail()->lessons()->first()->attachments()->value('name'));
    }

    public function test_students_cannot_upload(): void
    {
        $this->actingAs($this->user('aluno'))->post('/formador/uploads', [
            'kind' => 'cover', 'file' => $this->png(),
        ])->assertForbidden();
    }

    /** Envia um vídeo aos pedaços, como o editor; devolve a última resposta. */
    private function sendVideo(User $u, string $bytes, string $name = 'aula.mp4')
    {
        $id = (string) Str::uuid();
        $chunks = str_split($bytes, CourseBuilder::VIDEO_CHUNK_BYTES);
        foreach ($chunks as $i => $chunk) {
            $res = $this->actingAs($u)->post('/formador/videos', [
                // Como no browser (FormData), os números chegam como texto
                'id' => $id, 'index' => (string) $i, 'total' => (string) count($chunks), 'size' => (string) strlen($bytes), 'name' => $name,
                'chunk' => UploadedFile::fake()->createWithContent('chunk', $chunk),
            ], ['Accept' => 'application/json']);
        }

        return $res;
    }

    /** Início de um MP4 verdadeiro (caixa ftyp), com enchimento até ao tamanho pedido. */
    private function mp4(int $size): string
    {
        $head = hex2bin('00000018').'ftypmp42'.hex2bin('00000000').'mp42isom';

        return $head.str_repeat(hex2bin('00'), $size - strlen($head));
    }


    public function test_videos_are_uploaded_in_chunks_and_play_in_the_own_player(): void
    {
        Storage::fake('public');
        Storage::fake('local');
        $formador = $this->user('formador');

        $video = $this->sendVideo($formador, $this->mp4(CourseBuilder::VIDEO_CHUNK_BYTES + 5000))->assertOk()->assertJson(['done' => true])->json();
        $this->assertMatchesRegularExpression('#^/storage/cursos/videos/[a-z0-9]+.mp4$#', $video['url']);
        $path = substr($video['url'], strlen('/storage/'));
        Storage::disk('public')->assertExists($path);
        $this->assertSame(CourseBuilder::VIDEO_CHUNK_BYTES + 5000, Storage::disk('public')->size($path));
        $this->assertEmpty(Storage::disk('local')->allFiles('video-uploads')); // o temporário foi apagado

        // A aula com o vídeo carregado fica completa e toca no leitor próprio
        $data = $this->payload();
        $data['modules'][0]['lessons'][0]['url'] = $video['url'];
        $res = $this->actingAs($formador)->postJson('/formador/cursos', $data)->assertCreated()->json();
        $course = Course::where('ulid', $res['ulid'])->first();
        $lesson = $course->lessons()->where('lessons.title', 'Introdução')->first();
        $this->assertSame($video['url'], $lesson->content_url);
        $this->assertTrue(app(CourseBuilder::class)->lessonComplete($lesson));

        // Trocar o vídeo apaga o ficheiro antigo do disco
        $data['modules'][0]['id'] = $course->modules()->first()->id;
        $data['modules'][0]['lessons'][0]['id'] = $lesson->id;
        $data['modules'][0]['lessons'][0]['url'] = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
        $this->actingAs($formador)->putJson("/formador/cursos/{$course->ulid}", $data)->assertOk();
        Storage::disk('public')->assertMissing($path);
    }

    public function test_video_upload_rejects_other_files_and_students(): void
    {
        Storage::fake('public');
        Storage::fake('local');

        $this->sendVideo($this->user('formador'), '%PDF-1.4 não é vídeo', 'aula.mp4')->assertStatus(422);
        $this->sendVideo($this->user('formador'), $this->mp4(2000), 'aula.mov')->assertStatus(422);
        $this->sendVideo($this->user('aluno'), $this->mp4(2000))->assertForbidden();
        $this->assertEmpty(Storage::disk('public')->allFiles());

        // Pedaços fora de ordem não se juntam
        $this->actingAs($this->user('formador'))->post('/formador/videos', [
            'id' => (string) Str::uuid(), 'index' => 1, 'total' => 2, 'size' => 4000, 'name' => 'a.mp4',
            'chunk' => UploadedFile::fake()->createWithContent('chunk', 'x'),
        ], ['Accept' => 'application/json'])->assertStatus(409);
    }
}
