<?php

namespace App\Support;

use App\Models\Course;
use App\Models\Lesson;
use App\Models\LessonAttachment;
use App\Services\CourseBuilder;
use Illuminate\Support\Facades\Storage;

/**
 * Ficheiros que ficaram no disco sem uso: vídeos, anexos e capas carregados no editor mas nunca gravados num
 * curso (o formador desistiu ou fechou a página), e pedaços de envios de vídeo interrompidos.
 *
 * Só se corre à mão: `php artisan files:clean` mostra a lista; `php artisan files:clean --force` apaga.
 * Proteções (2026-11-16, depois de uma primeira versão automática ter apagado os ficheiros locais ao correr os
 * testes, em que a base de dados está vazia):
 * - nunca corre nos testes, a não ser com os discos falsos (Storage::fake);
 * - recusa se a base de dados não tiver cursos (todos os ficheiros pareceriam sem uso);
 * - só apaga ficheiros com mais de 24 horas.
 */
class OrphanFiles
{
    public const MIN_AGE_HOURS = 24;

    /**
     * @return array{videos: list<string>, anexos: list<string>, capas: list<string>, pedacos: list<string>}
     *               os caminhos encontrados (e apagados, se $delete)
     */
    public static function clean(bool $delete = false): array
    {
        $public = Storage::disk('public');
        $local = Storage::disk('local');
        if (app()->runningUnitTests() && ! (self::isFake($public) && self::isFake($local))) {
            throw new \RuntimeException('A limpeza de ficheiros não corre nos testes sem Storage::fake().');
        }
        if (! Course::withTrashed()->exists()) {
            throw new \RuntimeException('A base de dados não tem cursos: todos os ficheiros pareceriam sem uso. Nada foi apagado.');
        }

        $old = fn ($disk, $path) => $disk->lastModified($path) < now()->subHours(self::MIN_AGE_HOURS)->timestamp;
        $found = ['videos' => [], 'anexos' => [], 'capas' => [], 'pedacos' => []];

        // Vídeos em uso numa aula (também nas apagadas), com o link relativo ou completo (…/storage/cursos/videos/x.mp4)
        $videos = Lesson::withTrashed()->whereNotNull('content_url')->pluck('content_url')
            ->map(fn ($u) => preg_match('#/storage/('.preg_quote(CourseBuilder::VIDEO_DIR, '#').'/[\w-]+\.(mp4|webm))#', (string) $u, $m) ? $m[1] : null)
            ->filter()->flip();
        // Nos dois discos: os novos ficam no privado, os antigos no public até passarem (files:make-private)
        foreach ([$local, $public] as $disk) {
            foreach ($disk->files(CourseBuilder::VIDEO_DIR) as $path) {
                if (! $videos->has($path) && $old($disk, $path)) $found['videos'][] = $path;
            }
        }

        // Anexos (na pasta de cada pessoa ou na pasta antiga)
        $attachments = LessonAttachment::pluck('path')->flip();
        foreach ([$local, $public] as $disk) {
            foreach ($disk->allFiles(CourseBuilder::UPLOAD_DIR.'/anexos') as $path) {
                if (! $attachments->has($path) && $old($disk, $path)) $found['anexos'][] = $path;
            }
        }
        $found['videos'] = array_values(array_unique($found['videos']));
        $found['anexos'] = array_values(array_unique($found['anexos']));

        // Capas: o curso guarda o endereço (/storage/cursos/capas/…)
        $covers = Course::withTrashed()->whereNotNull('thumbnail_url')->pluck('thumbnail_url')
            ->map(fn ($u) => preg_match('#/storage/('.preg_quote(CourseBuilder::UPLOAD_DIR, '#').'/capas/[^/?\#]+)#', (string) $u, $m) ? $m[1] : null)
            ->filter()->flip();
        foreach ($public->files(CourseBuilder::UPLOAD_DIR.'/capas') as $path) {
            if (! $covers->has($path) && $old($public, $path)) $found['capas'][] = $path;
        }

        // Pedaços de envios de vídeo que não chegaram ao fim
        foreach ($local->files('video-uploads') as $path) {
            if (str_ends_with($path, '.part') && $old($local, $path)) $found['pedacos'][] = $path;
        }

        if ($delete) {
            CourseFiles::delete([...$found['videos'], ...$found['anexos']]);
            $public->delete($found['capas']);
            $local->delete($found['pedacos']);
        }

        return $found;
    }

    /** Disco criado por Storage::fake() (fica em storage/framework/testing). */
    private static function isFake($disk): bool
    {
        return str_contains(str_replace('\\', '/', $disk->path('')), 'framework/testing/disks');
    }
}
