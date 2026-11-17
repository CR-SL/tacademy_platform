<?php

namespace App\Http\Controllers\Learn;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Lesson;
use App\Models\LessonAttachment;
use App\Models\User;
use App\Services\CourseBuilder;
use App\Services\LearningService;
use App\Support\CourseFiles;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Entrega os vídeos e os anexos das aulas (ver CourseFiles), nos mesmos endereços de sempre
 * (/storage/cursos/videos/…, /storage/cursos/anexos/…), mas só a quem pode abrir a aula:
 * inscrito com o acesso válido, pré-visualização da equipa/formador, ou a aula de amostra.
 * Os vídeos podem avançar e recuar (pedidos Range: a resposta de ficheiro do Symfony trata disso).
 */
class MediaController extends Controller
{
    public function __construct(private LearningService $learning) {}

    public function video(Request $request, string $file): BinaryFileResponse
    {
        $path = CourseBuilder::VIDEO_DIR.'/'.$file;
        // O link pode estar relativo ou completo (https://…/storage/…); o "_" do LIKE apanha qualquer letra: confirma-se a seguir
        $lessons = Lesson::with('module.course')->where('content_url', 'like', '%/storage/'.$path)->get()
            ->filter(fn (Lesson $l) => str_ends_with((string) $l->content_url, '/storage/'.$path))->values();

        // Vídeo acabado de carregar no editor, ainda sem aula gravada: só quem cria cursos o pré-visualiza
        $allowed = $lessons->isEmpty()
            ? Gate::allows('create', Course::class)
            : $this->canOpenAny($request->user(), $lessons);

        return $this->serve($path, $allowed);
    }

    public function attachment(Request $request, string $path): BinaryFileResponse
    {
        $path = CourseBuilder::UPLOAD_DIR.'/anexos/'.$path;
        $attachments = LessonAttachment::with('lesson.module.course')->where('path', $path)->get();
        $user = $request->user();

        // Anexo acabado de carregar no editor: só quem o carregou (fica na sua pasta)
        $allowed = $attachments->isEmpty()
            ? str_starts_with($path, CourseBuilder::UPLOAD_DIR.'/'.CourseBuilder::attachmentDir($user->id).'/')
            : $this->canOpenAny($user, $attachments->pluck('lesson')->filter());

        return $this->serve($path, $allowed, $attachments->first()?->name);
    }

    /** Pode abrir alguma destas aulas (a mesma regra da página da aula). */
    private function canOpenAny(User $user, Collection $lessons): bool
    {
        return $lessons->contains(function (Lesson $lesson) use ($user) {
            $course = $lesson->module?->course;

            return $course && $this->learning->canOpen($this->learning->access($user, $course), $course, $lesson);
        });
    }

    private function serve(string $path, bool $allowed, ?string $name = null): BinaryFileResponse
    {
        // Sem acesso, 404 (não se diz que o ficheiro existe)
        abort_unless($allowed && ! str_contains($path, '..'), 404);
        $disk = CourseFiles::locate($path);
        abort_unless($disk, 404);

        $response = response()->file($disk->path($path), ['X-Content-Type-Options' => 'nosniff']);
        // Só o browser de quem pediu guarda o ficheiro (nunca uma cache partilhada, que o daria a outros)
        $response->setPrivate()->setMaxAge(3600);
        if ($name) {
            $response->setContentDisposition('inline', $name, str($name)->ascii()->replace(['/', '\\', '%'], '-')->value());
        }

        return $response;
    }
}
