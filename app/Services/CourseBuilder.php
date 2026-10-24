<?php

namespace App\Services;

use App\Models\Course;
use App\Models\Lesson;
use App\Models\LessonAttachment;
use App\Models\Module;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Editor de cursos dos formadores ("Os meus cursos").
 *
 * O editor envia sempre o curso inteiro (com módulos, aulas, anexos e quizzes) e
 * este serviço sincroniza-o com a base de dados: atualiza o que já existe (pelo id),
 * cria o que é novo e apaga o que foi removido. Cada módulo/aula novo traz uma
 * `key` gerada no browser; devolvemos key → id para o editor não os voltar a criar.
 */
class CourseBuilder
{
    /** Tipos de aula que o editor permite escolher. */
    public const LESSON_TYPES = ['video_link', 'avatar', 'document', 'text', 'quiz'];

    public const ACCESS_MONTHS = [3, 6, 12];

    /** Aulas desbloqueadas de cada vez (0 = todas). */
    public const UNLOCK_WINDOWS = [1, 3, 5, 0];

    public const SHORT_MAX = 160;

    /** Pasta (disco public) onde ficam capas e anexos carregados no editor. */
    public const UPLOAD_DIR = 'cursos';

    /** Curso no formato do editor (React). */
    public function toEditor(Course $course): array
    {
        $course->load(['modules.lessons.attachments', 'modules.lessons.checks', 'modules.lessons.quiz.questions.options']);

        return [
            'ulid' => $course->ulid,
            'slug' => $course->slug,
            'status' => $course->status,
            'title' => $course->title,
            'category_id' => $course->category_id,
            'level' => $course->level,
            // Cursos antigos sem capa guardada usam a mesma foto que o catálogo público
            'thumbnail_url' => $course->thumbnail_url ?: (config('tacademy.course_images')[$course->slug] ?? null),
            'short_description' => $course->short_description ?? '',
            'description' => $course->description ?? '',
            'learning_outcomes' => $course->learning_outcomes ?: [''],
            'prerequisites' => $course->prerequisites ?? '',
            'audience' => $course->audience ?? '',
            'is_free' => $course->is_free,
            'price' => $course->is_free || (float) $course->price === 0.0 ? '' : (string) $course->price,
            'access_months' => $course->access_months,
            'unlock_window' => $course->unlock_window,
            'certificate_enabled' => $course->certificate_enabled,
            'certificate_min_progress' => $course->certificate_min_progress,
            'certificate_min_score' => $course->certificate_min_score,
            'sample_lesson_key' => $course->sample_lesson_id ? 'l'.$course->sample_lesson_id : '',
            'modules' => $course->modules->map(fn (Module $m) => [
                'key' => 'm'.$m->id,
                'id' => $m->id,
                'title' => $m->title,
                'description' => $m->description ?? '',
                'lessons' => $m->lessons->map(fn (Lesson $l) => [
                    'key' => 'l'.$l->id,
                    'id' => $l->id,
                    'title' => $l->title,
                    'type' => $l->content_type,
                    'url' => ($l->content_type === 'avatar' ? $l->avatar_ref : $l->content_url) ?? '',
                    'minutes' => $l->duration_seconds ? (int) round($l->duration_seconds / 60) : '',
                    'body' => $l->body ?? '',
                    'attachments' => $l->attachments->map(fn (LessonAttachment $a) => [
                        'name' => $a->name, 'path' => $a->path, 'size' => $a->size, 'url' => $a->url(),
                    ])->values()->all(),
                    'quiz' => $l->quiz
                        ? $l->quiz->questions->map(fn ($q) => [
                            'question' => $q->question,
                            'options' => $q->options->pluck('option_text')->all(),
                            'correct' => max(0, $q->options->search(fn ($o) => $o->is_correct)),
                        ])->values()->all()
                        : [],
                    'checks' => $l->checks->map(fn ($c) => [
                        'question' => $c->question, 'options' => $c->options, 'correct' => $c->correct, 'explanation' => $c->explanation ?? '',
                    ])->values()->all(),
                ])->values()->all(),
            ])->values()->all(),
        ];
    }

    /**
     * Guarda o estado do editor. Devolve ['modules' => [key => id], 'lessons' => [key => id]].
     */
    public function save(Course $course, array $data): array
    {
        return DB::transaction(function () use ($course, $data) {
            $isFree = (bool) ($data['is_free'] ?? false);
            $title = trim($data['title'] ?? '');

            $course->fill([
                'title' => $title,
                'category_id' => $data['category_id'] ?? null,
                'level' => ($data['level'] ?? null) ?: ($course->level ?: 'iniciante'),
                'thumbnail_url' => $data['thumbnail_url'] ?? null,
                'short_description' => $data['short_description'] ?? null,
                'description' => $data['description'] ?? null,
                'learning_outcomes' => array_values(array_filter(array_map('trim', $data['learning_outcomes'] ?? []))),
                'prerequisites' => $data['prerequisites'] ?? null,
                'audience' => $data['audience'] ?? null,
                'is_free' => $isFree,
                'price' => $isFree ? 0 : (float) ($data['price'] ?? 0),
                'access_months' => $data['access_months'] ?? null,
                'unlock_window' => $data['unlock_window'] ?? 5,
                'certificate_enabled' => (bool) ($data['certificate_enabled'] ?? true),
                'certificate_min_progress' => $data['certificate_min_progress'] ?? 100,
                'certificate_min_score' => $data['certificate_min_score'] ?? 70,
            ]);

            // O endereço só muda enquanto o curso não está publicado (links partilhados não partem)
            if ($course->status !== 'published' || ! $course->slug) {
                $course->slug = $this->uniqueSlug($title ?: 'curso-'.Str::lower(Str::random(6)), $course->id);
            }
            $course->save();

            $maps = ['modules' => [], 'lessons' => []];
            $existingModules = $course->modules()->get()->keyBy('id');
            $existingLessons = Lesson::whereIn('module_id', $existingModules->keys())->get()->keyBy('id');
            $keptModules = [];
            $keptLessons = [];
            $minutes = 0;

            foreach (array_values($data['modules'] ?? []) as $mi => $m) {
                $module = isset($m['id']) && $existingModules->has($m['id'])
                    ? $existingModules[$m['id']]
                    : new Module(['course_id' => $course->id]);
                $module->fill(['title' => trim($m['title'] ?? ''), 'description' => $m['description'] ?? null, 'order_index' => $mi]);
                $module->course_id = $course->id;
                $module->save();
                $keptModules[] = $module->id;
                $maps['modules'][$m['key']] = $module->id;

                foreach (array_values($m['lessons'] ?? []) as $li => $l) {
                    $lesson = isset($l['id']) && $existingLessons->has($l['id']) ? $existingLessons[$l['id']] : new Lesson;
                    $type = $l['type'];
                    $url = trim($l['url'] ?? '');
                    $lesson->fill([
                        'module_id' => $module->id,
                        'title' => trim($l['title'] ?? ''),
                        'content_type' => $type,
                        'content_url' => $type === 'avatar' ? null : ($url ?: null),
                        'avatar_ref' => $type === 'avatar' ? ($url ?: null) : null,
                        'body' => $type === 'text' ? ($l['body'] ?? null) : null,
                        'duration_seconds' => (int) ($l['minutes'] ?? 0) * 60,
                        'order_index' => $li,
                    ]);
                    $lesson->save();
                    $keptLessons[] = $lesson->id;
                    $maps['lessons'][$l['key']] = $lesson->id;
                    $minutes += (int) ($l['minutes'] ?? 0);

                    $this->syncAttachments($lesson, $l['attachments'] ?? []);
                    $this->syncQuiz($lesson, $type === 'quiz' ? ($l['quiz'] ?? []) : null);
                    $this->syncChecks($lesson, in_array($type, ['video_link', 'video_upload'], true) ? ($l['checks'] ?? []) : []);
                }
            }

            // Removidos no editor
            $existingLessons->except($keptLessons)->each(function (Lesson $l) {
                $this->syncAttachments($l, []);
                $l->delete();
            });
            $existingModules->except($keptModules)->each->delete();

            $sample = $data['sample_lesson_key'] ?? '';
            $course->forceFill([
                'duration_minutes' => $minutes,
                'sample_lesson_id' => $sample ? ($maps['lessons'][$sample] ?? null) : null,
            ])->save();

            return $maps;
        });
    }

    /**
     * O que falta para publicar (vazio = pode publicar). Cada item: [texto, passo do editor].
     *
     * @return array<int, array{0: string, 1: int}>
     */
    public function publishProblems(Course $course): array
    {
        $course->load(['modules.lessons.attachments', 'modules.lessons.checks', 'modules.lessons.quiz.questions.options']);
        $lessons = $course->modules->flatMap->lessons;
        $problems = [];

        if (! trim($course->title)) $problems[] = ['Título do curso', 0];
        if (! $course->category_id || ! $course->level) $problems[] = ['Área e nível', 0];
        if (! $course->thumbnail_url) $problems[] = ['Imagem de capa', 0];
        if (! trim((string) $course->short_description) || mb_strlen($course->short_description) > self::SHORT_MAX) {
            $problems[] = ['Descrição curta', 0];
        }
        if ($lessons->isEmpty()) $problems[] = ['Pelo menos 1 módulo com 1 aula', 1];
        if ($course->modules->contains(fn ($m) => ! trim($m->title))) $problems[] = ['Todos os módulos têm título', 1];
        if ($lessons->contains(fn ($l) => ! $this->lessonComplete($l))) {
            $problems[] = ['Todas as aulas completas (título + link/conteúdo)', 1];
        }
        if (! $course->is_free && (float) $course->price <= 0) $problems[] = ['Preço definido', 2];

        return $problems;
    }

    public function lessonComplete(Lesson $l): bool
    {
        if (! trim($l->title)) return false;

        return match ($l->content_type) {
            'video_link', 'video_upload' => self::validUrl($l->content_url),
            'avatar' => self::validUrl($l->avatar_ref),
            'document' => $l->attachments->isNotEmpty(),
            'text' => trim(strip_tags((string) $l->body)) !== '',
            'quiz' => $l->quiz && $l->quiz->questions->isNotEmpty() && $l->quiz->questions->every(
                fn ($q) => trim($q->question) && $q->options->filter(fn ($o) => trim($o->option_text))->count() >= 2
            ),
            default => true,
        };
    }

    public static function validUrl(?string $url): bool
    {
        return (bool) filter_var($url, FILTER_VALIDATE_URL) && preg_match('#^https?://#i', $url);
    }

    private function uniqueSlug(string $title, ?int $ignoreId): string
    {
        $base = Str::slug($title) ?: 'curso';
        $slug = $base;
        for ($i = 2; Course::withTrashed()->where('slug', $slug)->when($ignoreId, fn ($q) => $q->whereKeyNot($ignoreId))->exists(); $i++) {
            $slug = "{$base}-{$i}";
        }

        return $slug;
    }

    /** Mantém os anexos cujo ficheiro continua no editor; apaga os restantes (e o ficheiro). */
    private function syncAttachments(Lesson $lesson, array $items): void
    {
        $current = $lesson->attachments()->get()->keyBy('path');
        $keep = [];
        foreach (array_values($items) as $i => $a) {
            $path = $a['path'] ?? '';
            // Ficheiros fixos do projeto (ex.: materiais do curso de demonstração em /cursos-demo/) mantêm-se tal como estão
            if ($current->has($path) && str_starts_with($path, '/')) {
                $keep[] = $path;
                $current[$path]->update(['order_index' => $i]);
                continue;
            }
            if (! str_starts_with($path, self::UPLOAD_DIR.'/anexos/')) continue; // só ficheiros carregados pelo editor
            $keep[] = $path;
            if ($current->has($path)) {
                $current[$path]->update(['order_index' => $i]);
            } elseif (Storage::disk('public')->exists($path)) {
                $lesson->attachments()->create([
                    'name' => Str::limit($a['name'] ?? basename($path), 195, ''),
                    'path' => $path,
                    'size' => Storage::disk('public')->size($path),
                    'order_index' => $i,
                ]);
            }
        }
        $current->except($keep)->each(function (LessonAttachment $a) {
            if (! str_starts_with($a->path, '/')) Storage::disk('public')->delete($a->path); // ficheiros do projeto não se apagam
            $a->delete();
        });
    }

    /** Substitui as perguntas rápidas do fim da aula (só aulas de vídeo; perguntas vazias são ignoradas). */
    private function syncChecks(Lesson $lesson, array $checks): void
    {
        $lesson->checks()->delete();
        foreach (array_values(array_filter($checks, fn ($c) => trim($c['question'] ?? '') !== '')) as $i => $c) {
            $options = array_values(array_filter(array_map(fn ($o) => trim((string) $o), $c['options'] ?? []), fn ($o) => $o !== ''));
            if (count($options) < 2) continue;
            $lesson->checks()->create([
                'question' => trim($c['question']),
                'options' => $options,
                'correct' => min((int) ($c['correct'] ?? 0), count($options) - 1),
                'explanation' => trim($c['explanation'] ?? '') ?: null,
                'order_index' => $i,
            ]);
        }
    }

    /** Substitui as perguntas do quiz da aula (null = a aula já não é quiz). */
    private function syncQuiz(Lesson $lesson, ?array $questions): void
    {
        if ($questions === null) {
            $lesson->quiz()->delete();

            return;
        }
        $quiz = $lesson->quiz()->firstOrCreate([], ['title' => $lesson->title ?: 'Quiz']);
        $quiz->update(['title' => $lesson->title ?: 'Quiz']);
        $quiz->questions()->delete(); // as opções vão em cascata
        foreach (array_values($questions) as $qi => $q) {
            $question = $quiz->questions()->create(['question' => trim($q['question'] ?? ''), 'order_index' => $qi]);
            foreach (array_values($q['options'] ?? []) as $oi => $text) {
                $question->options()->create(['option_text' => trim((string) $text), 'is_correct' => $oi === (int) ($q['correct'] ?? 0)]);
            }
        }
    }
}
