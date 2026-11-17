<?php

namespace App\Support;

use App\Services\CourseBuilder;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Facades\Storage;

/**
 * Vídeos e anexos das aulas: ficam no disco privado (storage/app/private/cursos/…), fora do alcance do servidor web.
 * Os endereços continuam iguais (/storage/cursos/videos/…, /storage/cursos/anexos/…): quando o ficheiro não está
 * na pasta pública, o pedido chega à app (MediaController), que só o entrega a quem pode abrir a aula.
 *
 * Os ficheiros carregados antes desta mudança ficam no disco public até se correr `php artisan files:make-private`;
 * até lá continuam a abrir pelo endereço direto. As capas dos cursos continuam públicas (aparecem no catálogo).
 */
class CourseFiles
{
    /** A proteção está ligada? (desligada no Railway: ver config/tacademy.php, private_files) */
    public static function enabled(): bool
    {
        return (bool) config('tacademy.private_files');
    }

    /** Disco onde se gravam os vídeos e anexos novos: o privado, ou o public com a proteção desligada. */
    public static function disk(): Filesystem
    {
        return Storage::disk(self::diskName());
    }

    public static function diskName(): string
    {
        return self::enabled() ? 'local' : 'public';
    }

    /** Pastas (relativas aos discos) que são protegidas. */
    public static function protectedDirs(): array
    {
        return [CourseBuilder::VIDEO_DIR, CourseBuilder::UPLOAD_DIR.'/anexos'];
    }

    public static function isProtected(string $path): bool
    {
        foreach (self::protectedDirs() as $dir) {
            if (str_starts_with($path, $dir.'/')) return true;
        }

        return false;
    }

    /** O disco onde o ficheiro está: primeiro o privado, depois o public (ficheiros ainda não passados). */
    public static function locate(string $path): ?Filesystem
    {
        if (str_contains($path, '..')) return null;
        foreach ([self::disk(), Storage::disk('public')] as $disk) {
            if ($disk->exists($path)) return $disk;
        }

        return null;
    }

    public static function exists(string $path): bool
    {
        return self::locate($path) !== null;
    }

    public static function size(string $path): ?int
    {
        return self::locate($path)?->size($path);
    }

    /**
     * Passa os vídeos e anexos que ainda estão no disco public para o privado (`php artisan files:make-private`).
     * Sem $move só devolve a lista. Com $move, cada ficheiro é copiado e só sai do public depois de confirmado
     * que a cópia ficou inteira (mesmo tamanho); se a cópia falhar, o original fica onde estava.
     *
     * @return array{moved: list<string>, failed: list<string>}
     */
    public static function makePrivate(bool $move = false): array
    {
        if (! self::enabled()) {
            throw new \RuntimeException('A pasta privada está desligada neste servidor (no Railway não sobrevive aos deploys). Nada foi mexido.');
        }
        $public = Storage::disk('public');
        $private = self::disk();
        if (app()->runningUnitTests() && ! (self::isFake($public) && self::isFake($private))) {
            throw new \RuntimeException('files:make-private não corre nos testes sem Storage::fake().');
        }

        $result = ['moved' => [], 'failed' => []];
        foreach (self::protectedDirs() as $dir) {
            foreach ($public->allFiles($dir) as $path) {
                if (! $move) {
                    $result['moved'][] = $path;
                    continue;
                }
                $size = $public->size($path);
                $copied = $private->exists($path) && $private->size($path) === $size;
                if (! $copied) {
                    $in = $public->readStream($path);
                    try {
                        $private->writeStream($path, $in);
                    } catch (\Throwable) {
                        // fica como falhado
                    } finally {
                        if (is_resource($in)) fclose($in);
                    }
                    clearstatcache();
                    $copied = $private->exists($path) && $private->size($path) === $size;
                }
                if ($copied) {
                    $public->delete($path);
                    $result['moved'][] = $path;
                } else {
                    $private->delete($path); // cópia cortada (disco cheio?): o original continua no public
                    $result['failed'][] = $path;
                }
            }
        }

        return $result;
    }

    /** Disco criado por Storage::fake() (fica em storage/framework/testing). */
    private static function isFake($disk): bool
    {
        return str_contains(str_replace('\\', '/', $disk->path('')), 'framework/testing/disks');
    }

    /** Apaga dos dois discos (um ficheiro pode estar num ou noutro). */
    public static function delete(string|array $paths): void
    {
        $paths = (array) $paths;
        self::disk()->delete($paths);
        Storage::disk('public')->delete($paths);
    }
}
