<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Course;
use App\Models\Lesson;
use App\Models\LessonAttachment;
use App\Models\Module;
use App\Support\OrphanFiles;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

/** Limpeza dos ficheiros carregados que ficaram sem uso (revisão V1, A24). */
class OrphanFilesTest extends TestCase
{
    use RefreshDatabase;

    private function file($disk, string $path, bool $old = true): void
    {
        Storage::disk($disk)->put($path, 'x');
        if ($old) touch(Storage::disk($disk)->path($path), now()->subHours(30)->timestamp);
    }

    public function test_only_old_files_without_use_are_deleted(): void
    {
        Storage::fake('public');
        Storage::fake('local');
        $cat = Category::create(['slug' => 'm', 'name' => 'M', 'color_hex' => '#F8B101']);
        $course = Course::create(['ulid' => (string) Str::ulid(), 'category_id' => $cat->id, 'title' => 'C', 'slug' => 'c', 'level' => 'iniciante',
            'status' => 'draft', 'price' => 0, 'thumbnail_url' => '/storage/cursos/capas/usada.jpg']);
        $m = Module::create(['course_id' => $course->id, 'title' => 'M', 'order_index' => 0]);
        $l = Lesson::create(['module_id' => $m->id, 'title' => 'V', 'content_type' => 'video_link', 'content_url' => '/storage/cursos/videos/usado.mp4', 'order_index' => 0]);
        LessonAttachment::create(['lesson_id' => $l->id, 'name' => 'a.pdf', 'path' => 'cursos/anexos/u1/usado.pdf', 'size' => 1]);

        $this->file('public', 'cursos/videos/usado.mp4');
        $this->file('public', 'cursos/videos/orfao.mp4');
        $this->file('public', 'cursos/videos/recente.mp4', old: false); // ainda pode estar a ser gravado
        $this->file('public', 'cursos/anexos/u1/usado.pdf');
        $this->file('public', 'cursos/anexos/u1/orfao.pdf');
        $this->file('public', 'cursos/capas/usada.jpg');
        $this->file('public', 'cursos/capas/orfa.jpg');
        $this->file('local', 'video-uploads/1-abc.part');

        // Sem ordem para apagar, só mostra a lista
        $expected = ['videos' => ['cursos/videos/orfao.mp4'], 'anexos' => ['cursos/anexos/u1/orfao.pdf'], 'capas' => ['cursos/capas/orfa.jpg'], 'pedacos' => ['video-uploads/1-abc.part']];
        $this->assertSame($expected, OrphanFiles::clean());
        Storage::disk('public')->assertExists('cursos/videos/orfao.mp4');

        $this->assertSame($expected, OrphanFiles::clean(delete: true));
        Storage::disk('public')->assertExists(['cursos/videos/usado.mp4', 'cursos/videos/recente.mp4', 'cursos/anexos/u1/usado.pdf', 'cursos/capas/usada.jpg']);
        Storage::disk('public')->assertMissing(['cursos/videos/orfao.mp4', 'cursos/anexos/u1/orfao.pdf', 'cursos/capas/orfa.jpg']);
        Storage::disk('local')->assertMissing('video-uploads/1-abc.part');
    }

    public function test_it_refuses_to_run_on_the_real_disk_or_an_empty_database(): void
    {
        // Nos testes, sem discos falsos: recusa (foi assim que a 1.ª versão apagou os ficheiros locais)
        $this->expectException(\RuntimeException::class);
        OrphanFiles::clean();
    }

    public function test_it_refuses_with_an_empty_database(): void
    {
        Storage::fake('public');
        Storage::fake('local');
        $this->expectExceptionMessage('não tem cursos');
        OrphanFiles::clean(delete: true);
    }
}
