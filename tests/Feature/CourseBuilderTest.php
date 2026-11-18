<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Course;
use App\Models\LessonAttachment;
use App\Models\LessonProgress;
use App\Models\QuizAttempt;
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
                    ['key' => 'nC', 'id' => null, 'title' => 'Pergunta ao avatar', 'type' => 'avatar', 'url' => 'https://tavus.daily.co/s1', 'minutes' => 8, 'body' => '', 'attachments' => [], 'quiz' => []],
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
        $this->assertSame('https://tavus.daily.co/s1', $course->lessons()->where('content_type', 'avatar')->value('avatar_ref'));
        $this->assertSame($res->json('lessons.nB'), $course->sample_lesson_id);

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

    /** Estado que o editor envia: o que o servidor lhe deu (com ids), como o React o guarda. */
    private function editorState(Course $course): array
    {
        $state = app(CourseBuilder::class)->toEditor($course->fresh());
        unset($state['ulid'], $state['slug']);

        return json_decode(json_encode($state), true);
    }

    public function test_saving_the_editor_keeps_quiz_attempts_and_quick_check_answers(): void
    {
        $formador = $this->user('formador');
        $aluno = $this->user('aluno');
        $this->actingAs($formador)->postJson('/formador/cursos', $this->payload())->assertCreated();
        $course = Course::firstOrFail();

        $quizLesson = $course->lessons()->where('content_type', 'quiz')->first();
        $question = $quizLesson->quiz->questions->first();
        $right = $question->options->firstWhere('is_correct', true);
        $attempt = QuizAttempt::create(['user_id' => $aluno->id, 'quiz_id' => $quizLesson->quiz->id, 'score' => 100, 'passed' => true,
            'answers' => [$question->id => $right->id], 'attempted_at' => now()]);
        $videoLesson = $course->lessons()->where('content_type', 'video_link')->first();
        $check = $videoLesson->checks->first();
        LessonProgress::create(['user_id' => $aluno->id, 'lesson_id' => $videoLesson->id, 'status' => 'in_progress', 'check_answers' => [(string) $check->id => 0]]);

        // O formador corrige o texto da pergunta e de uma opção, e acrescenta uma opção e uma pergunta
        $data = $this->editorState($course);
        $quiz = &$data['modules'][0]['lessons'][2]['quiz'];
        $quiz[0]['question'] = 'Pressão em ralenti (aprox.)?';
        $quiz[0]['options'][0] = '50 bar (baixa)';
        $quiz[0]['options'][] = '1000 bar';
        $quiz[0]['option_ids'][] = null;
        $quiz[] = ['key' => 'nQ', 'id' => null, 'question' => 'Nova?', 'options' => ['Sim', 'Não'], 'option_ids' => [null, null], 'correct' => 0];
        unset($quiz);
        $data['modules'][0]['lessons'][0]['checks'][0]['explanation'] = 'Alimenta os injetores.';

        $res = $this->actingAs($formador)->putJson("/formador/cursos/{$course->ulid}", $data)->assertOk();

        // As ids ficam: a tentativa continua a apontar para a pergunta e a opção certas
        $question->refresh()->load('options');
        $this->assertSame('Pressão em ralenti (aprox.)?', $question->question);
        $this->assertSame(['50 bar (baixa)', '300 bar', '1000 bar'], $question->options->pluck('option_text')->all());
        $this->assertTrue($question->options->firstWhere('id', $right->id)->is_correct);
        $this->assertNotNull($attempt->fresh());
        $this->assertSame('Alimenta os injetores.', $check->fresh()->explanation);
        $this->assertCount(2, $quizLesson->quiz->questions()->get());
        $this->assertNotNull($res->json('questions.nQ.id'));
        $this->assertCount(2, $res->json('questions.nQ.option_ids'));

        // Uma segunda gravação com as ids devolvidas não cria cópias
        $data = $this->editorState($course);
        $this->actingAs($formador)->putJson("/formador/cursos/{$course->ulid}", $data)->assertOk();
        $this->assertCount(2, $quizLesson->quiz->questions()->get());
        $this->assertSame($right->id, $question->options()->where('is_correct', true)->value('id'));
    }

    public function test_a_published_course_cannot_be_saved_incomplete(): void
    {
        $formador = $this->user('formador');
        $this->actingAs($formador)->postJson('/formador/cursos', $this->payload())->assertCreated();
        $course = Course::firstOrFail();
        $course->update(['status' => 'published']);

        // Apagar todas as aulas de um curso publicado é recusado e nada muda
        $data = $this->editorState($course);
        $data['modules'][0]['lessons'] = [];
        $this->actingAs($formador)->putJson("/formador/cursos/{$course->ulid}", $data)->assertStatus(422)->assertJsonValidationErrors('course');
        $this->assertCount(3, $course->lessons()->get());

        // Em rascunho já se pode gravar incompleto
        $course->update(['status' => 'draft']);
        $this->actingAs($formador)->putJson("/formador/cursos/{$course->ulid}", $data)->assertOk();
        $this->assertCount(0, $course->lessons()->get());
    }

    public function test_saved_attachments_stay_when_the_course_is_saved_again(): void
    {
        $formador = $this->user('formador');
        $this->actingAs($formador)->postJson('/formador/cursos', $this->payload())->assertCreated();
        $course = Course::firstOrFail();
        Storage::fake('public');
        $dir = CourseBuilder::UPLOAD_DIR.'/'.CourseBuilder::attachmentDir($formador->id);
        Storage::disk('public')->put("$dir/a.pdf", '%PDF-1.4');
        Storage::disk('public')->put("$dir/b.pdf", '%PDF-1.4');

        $data = $this->editorState($course);
        $data['modules'][0]['lessons'][0]['attachments'] = [['name' => 'a.pdf', 'path' => "$dir/a.pdf"]];
        $this->actingAs($formador)->putJson("/formador/cursos/{$course->ulid}", $data)->assertOk();

        // Gravar outra vez (como o editor faz a cada alteração) e juntar um segundo anexo: o primeiro fica
        $data = $this->editorState($course);
        $data['modules'][0]['lessons'][0]['attachments'][] = ['name' => 'b.pdf', 'path' => "$dir/b.pdf"];
        $this->actingAs($formador)->putJson("/formador/cursos/{$course->ulid}", $data)->assertOk();
        $this->actingAs($formador)->putJson("/formador/cursos/{$course->ulid}", $this->editorState($course))->assertOk();

        $this->assertSame(['a.pdf', 'b.pdf'], LessonAttachment::orderBy('order_index')->pluck('name')->all());
        Storage::disk('public')->assertExists(["$dir/a.pdf", "$dir/b.pdf"]);
    }

    public function test_a_published_course_already_missing_something_still_saves_other_changes(): void
    {
        $formador = $this->user('formador');
        $this->actingAs($formador)->postJson('/formador/cursos', $this->payload())->assertCreated();
        $course = Course::firstOrFail();
        $course->update(['status' => 'published']);
        // Um vídeo que ficou sem endereço (por ex. não chegou a ficar no servidor)
        $course->lessons()->where('content_type', 'video_link')->update(['content_url' => null]);

        // Juntar um anexo a outra aula grava na mesma
        Storage::fake('public');
        $path = CourseBuilder::UPLOAD_DIR.'/'.CourseBuilder::attachmentDir($formador->id).'/ficha.pdf';
        Storage::disk('public')->put($path, '%PDF-1.4');
        $data = $this->editorState($course);
        $data['modules'][0]['lessons'][1]['attachments'] = [['name' => 'ficha.pdf', 'path' => $path]];
        $this->actingAs($formador)->putJson("/formador/cursos/{$course->ulid}", $data)->assertOk();
        $this->assertSame(1, LessonAttachment::count());

        // Deixar a faltar outra coisa (o título) continua a ser recusado
        $data['title'] = '';
        $this->actingAs($formador)->putJson("/formador/cursos/{$course->ulid}", $data)->assertStatus(422)->assertJsonValidationErrors('course');
    }

    public function test_a_course_with_students_cannot_be_deleted(): void
    {
        $formador = $this->user('formador');
        $this->actingAs($formador)->postJson('/formador/cursos', $this->payload())->assertCreated();
        $course = Course::firstOrFail();
        \App\Models\Enrollment::create(['user_id' => $this->user('aluno')->id, 'course_id' => $course->id, 'source' => 'manual', 'enrolled_at' => now()]);

        $this->actingAs($formador)->delete("/formador/cursos/{$course->ulid}")->assertRedirect()->assertSessionHas('status');
        $this->assertNotNull($course->fresh());
    }

    public function test_a_quiz_with_attempts_cannot_change_type(): void
    {
        $formador = $this->user('formador');
        $this->actingAs($formador)->postJson('/formador/cursos', $this->payload())->assertCreated();
        $course = Course::firstOrFail();
        $quizLesson = $course->lessons()->where('content_type', 'quiz')->first();
        QuizAttempt::create(['user_id' => $this->user('aluno')->id, 'quiz_id' => $quizLesson->quiz->id, 'score' => 0, 'passed' => false, 'answers' => [], 'attempted_at' => now()]);

        $data = $this->editorState($course);
        $data['modules'][0]['lessons'][2]['type'] = 'text';
        $this->actingAs($formador)->putJson("/formador/cursos/{$course->ulid}", $data)->assertStatus(422);

        $this->assertSame('quiz', $quizLesson->fresh()->content_type);
        $this->assertSame(1, QuizAttempt::count());
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

    public function test_a_video_lesson_without_minutes_blocks_publishing(): void
    {
        // Sem os minutos o vídeo não conclui a aula (auditoria, ponto 5), por isso são obrigatórios para publicar
        $formador = $this->user('formador');
        $this->actingAs($formador)->postJson('/formador/cursos', $this->payload());
        $course = Course::firstOrFail();
        $course->modules->flatMap->lessons->firstWhere('content_type', 'video_link')->update(['duration_seconds' => 0]);

        $problems = app(\App\Services\CourseBuilder::class)->publishProblems($course->fresh());
        $this->assertContains('Minutos em todas as aulas de vídeo', array_column($problems, 0));
        $this->actingAs($formador)->post("/formador/cursos/{$course->ulid}/publicar")->assertSessionHasErrors('publish');
        $this->assertSame('draft', $course->fresh()->status);
    }

    public function test_a_published_course_appears_in_the_public_catalog(): void
    {
        $formador = $this->user('formador');
        $this->actingAs($formador)->postJson('/formador/cursos', $this->payload());
        $course = Course::firstOrFail();

        $this->get('/plataforma/cursos')->assertInertia(fn ($p) => $p->has('courses', 0));

        $this->actingAs($formador)->post("/formador/cursos/{$course->ulid}/publicar")
            ->assertRedirect('/formador/cursos');

        $this->assertSame('published', $course->fresh()->status);
        $this->get('/plataforma/cursos')->assertInertia(fn ($p) => $p->where('courses.0.title', 'Sistemas de Injeção Common Rail'));
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


    public function test_attachments_are_sent_in_pieces_and_checked_at_the_end(): void
    {
        Storage::fake('public');
        $u = $this->user('formador');
        $send = function (User $who, string $bytes, string $name) {
            $id = (string) Str::uuid();
            $chunks = str_split($bytes, CourseBuilder::VIDEO_CHUNK_BYTES);
            foreach ($chunks as $i => $chunk) {
                $res = $this->actingAs($who)->post('/formador/anexos', [
                    'id' => $id, 'index' => (string) $i, 'total' => (string) count($chunks), 'size' => (string) strlen($bytes), 'name' => $name,
                    'chunk' => UploadedFile::fake()->createWithContent('chunk', $chunk),
                ], ['Accept' => 'application/json']);
            }

            return $res;
        };

        // Um PDF maior do que um pedaço (3 pedaços) fica na pasta de anexos de quem o carrega
        $pdf = "%PDF-1.4\n".str_repeat("1 0 obj\n", 500000);
        $r = $send($u, $pdf, 'Caderno técnico.pdf')->assertOk()->assertJsonPath('done', true)->assertJsonPath('name', 'Caderno técnico.pdf')->json();
        $this->assertStringStartsWith('cursos/anexos/u'.$u->id.'/', $r['path']);
        $this->assertStringEndsWith('.pdf', $r['path']);
        // Na pasta privada (só se entrega a quem pode ver a aula)
        $this->assertSame(strlen($pdf), Storage::disk('local')->size($r['path']));

        // Tipo errado no nome ou no conteúdo, ou quem não cria cursos: recusado e nada fica guardado
        $send($u, $pdf, 'script.php')->assertStatus(422);
        $send($u, '<?php echo 1; ?>', 'falso.pdf')->assertStatus(422);
        $send($this->user('aluno'), $pdf, 'c.pdf')->assertForbidden();
        $this->assertCount(1, Storage::disk('local')->allFiles('cursos'));
        $this->assertEmpty(Storage::disk('public')->allFiles());

        // Acima do limite: recusado logo no primeiro pedaço
        $this->actingAs($u)->post('/formador/anexos', [
            'id' => (string) Str::uuid(), 'index' => 0, 'total' => 1, 'size' => (config('tacademy.attachment_max_mb') + 1) * 1024 * 1024, 'name' => 'grande.pdf',
            'chunk' => UploadedFile::fake()->createWithContent('chunk', 'x'),
        ], ['Accept' => 'application/json'])->assertStatus(422);
    }

    public function test_an_instructor_cannot_attach_or_delete_someone_elses_file(): void
    {
        Storage::fake('public');
        $a = $this->user('formador');
        $b = $this->user('formador');
        $doc = $this->actingAs($a)->post('/formador/uploads', [
            'kind' => 'attachment', 'file' => UploadedFile::fake()->create('esquema.pdf', 200, 'application/pdf'),
        ])->assertOk()->json();
        $this->assertStringStartsWith('cursos/anexos/u'.$a->id.'/', $doc['path']);

        // O formador B tenta pôr no seu curso o anexo do A (e um caminho com "..") e retirá-los depois
        $this->actingAs($b)->postJson('/formador/cursos', $this->payload())->assertCreated();
        $course = Course::where('instructor_id', $b->id)->firstOrFail();
        $data = $this->editorState($course);
        $data['modules'][0]['lessons'][0]['attachments'] = [
            ['name' => 'alheio.pdf', 'path' => $doc['path']],
            ['name' => 'truque.pdf', 'path' => 'cursos/anexos/u'.$b->id.'/../u'.$a->id.'/'.basename($doc['path'])],
        ];
        $this->actingAs($b)->putJson("/formador/cursos/{$course->ulid}", $data)->assertOk();
        $this->assertSame(0, $course->lessons()->first()->attachments()->count());

        $data['modules'][0]['lessons'][0]['attachments'] = [];
        $this->actingAs($b)->putJson("/formador/cursos/{$course->ulid}", $data)->assertOk();
        Storage::disk('local')->assertExists($doc['path']);
    }

    public function test_videos_are_uploaded_in_chunks_and_play_in_the_own_player(): void
    {
        Storage::fake('public');
        Storage::fake('local');
        $formador = $this->user('formador');

        $video = $this->sendVideo($formador, $this->mp4(CourseBuilder::VIDEO_CHUNK_BYTES + 5000))->assertOk()->assertJson(['done' => true])->json();
        $this->assertMatchesRegularExpression('#^/storage/cursos/videos/[a-z0-9]+.mp4$#', $video['url']);
        $path = substr($video['url'], strlen('/storage/'));
        Storage::disk('local')->assertExists($path);
        $this->assertSame(CourseBuilder::VIDEO_CHUNK_BYTES + 5000, Storage::disk('local')->size($path));
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
        Storage::disk('local')->assertMissing($path);
    }

    public function test_video_upload_rejects_other_files_and_students(): void
    {
        Storage::fake('public');
        Storage::fake('local');

        $this->sendVideo($this->user('formador'), '%PDF-1.4 não é vídeo', 'aula.mp4')->assertStatus(422);
        $this->sendVideo($this->user('formador'), $this->mp4(2000), 'aula.mov')->assertStatus(422);
        $this->sendVideo($this->user('aluno'), $this->mp4(2000))->assertForbidden();
        $this->assertEmpty(Storage::disk('public')->allFiles());
        $this->assertEmpty(Storage::disk('local')->allFiles('cursos'));

        // Pedaços fora de ordem não se juntam
        $this->actingAs($this->user('formador'))->post('/formador/videos', [
            'id' => (string) Str::uuid(), 'index' => 1, 'total' => 2, 'size' => 4000, 'name' => 'a.mp4',
            'chunk' => UploadedFile::fake()->createWithContent('chunk', 'x'),
        ], ['Accept' => 'application/json'])->assertStatus(409);
    }

    public function test_trainer_turns_on_the_avatar_and_staff_can_block_it(): void
    {
        $formador = $this->user('formador');
        $gestor = $this->user('gestor_cursos');
        $alex = ['alex_enabled' => true, 'alex_pal_id' => 'p-curso', 'alex_face_id' => 'f-curso'];

        // O formador liga o avatar no seu curso, com o PAL e o rosto do curso
        $this->actingAs($formador)->postJson('/formador/cursos', $this->payload($alex))->assertCreated();
        $course = Course::firstOrFail();
        $this->assertTrue($course->alex_enabled);
        $this->assertSame('p-curso', $course->alex_pal_id);
        $this->assertSame('f-curso', $course->alex_face_id);
        $this->actingAs($formador)->get("/formador/cursos/{$course->ulid}/editar")
            ->assertInertia(fn ($p) => $p->where('canAlex', true)->where('canManageAlex', false));

        // O formador não se desbloqueia a si próprio
        $this->actingAs($formador)->putJson("/formador/cursos/{$course->ulid}", $this->payload([...$alex, 'alex_blocked' => true]))->assertOk();
        $this->assertFalse($course->fresh()->alex_blocked);

        // O gestor de cursos (sem editar cursos) desliga e bloqueia na Administração › Formador IA
        $this->actingAs($gestor)->get('/administracao/formador-ia')->assertOk()
            ->assertInertia(fn ($p) => $p->where('data.courses.0.ulid', $course->ulid)->where('data.courses.0.enabled', true));
        $this->actingAs($gestor)->put("/administracao/formador-ia/{$course->ulid}", ['blocked' => true])->assertRedirect();
        $course->refresh();
        $this->assertFalse($course->alex_enabled);
        $this->assertTrue($course->alex_blocked);

        // Bloqueado: o formador já não o liga
        $this->actingAs($formador)->putJson("/formador/cursos/{$course->ulid}", $this->payload($alex))->assertOk();
        $this->assertFalse($course->fresh()->alex_enabled);
        $this->actingAs($formador)->put("/administracao/formador-ia/{$course->ulid}", ['blocked' => false])->assertForbidden();

        // O admin desbloqueia no editor; o avatar fica desligado até o formador o ligar
        $this->actingAs($this->user('admin'))->putJson("/formador/cursos/{$course->ulid}", $this->payload(['alex_enabled' => false, 'alex_blocked' => false]))->assertOk();
        $this->assertFalse($course->fresh()->alex_blocked);
        $this->actingAs($formador)->putJson("/formador/cursos/{$course->ulid}", $this->payload($alex))->assertOk();
        $this->assertTrue($course->fresh()->alex_enabled);

        // As permissões por omissão: o formador liga, o gestor de cursos desliga e bloqueia
        $this->assertTrue($formador->canDo('cursos.alex'));
        $this->assertTrue($gestor->canDo('cursos.alex.gerir'));
        $this->assertFalse($formador->canDo('cursos.alex.gerir'));
    }
}
