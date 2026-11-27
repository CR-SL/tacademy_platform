<?php

namespace App\Services;

use App\Models\Course;
use App\Models\Lesson;
use App\Models\LessonAttachment;
use App\Models\Module;
use App\Models\QuizAttempt;
use App\Support\CourseFiles;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

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

    /** Prazos que quem cria o curso pode escolher (dias a contar da inscrição). */
    public const DEADLINE_DAYS = [30, 60, 90, 180];

    public const SHORT_MAX = 160;

    /** Quem está a gravar: só os anexos novos que esta pessoa carregou são aceites (ver syncAttachments). */
    private ?int $uploaderId = null;

    /** Pasta dos anexos carregados por uma pessoa (dentro de UPLOAD_DIR). */
    public static function attachmentDir(int $userId): string
    {
        return 'anexos/u'.$userId;
    }

    /** Pasta onde ficam capas (disco public) e anexos (disco privado, ver CourseFiles) carregados no editor. */
    public const UPLOAD_DIR = 'cursos';

    /** Vídeos carregados pelo formador (disco privado, ver CourseFiles), entregues em /storage/cursos/videos/… só a quem pode ver a aula */
    public const VIDEO_DIR = self::UPLOAD_DIR.'/videos';

    /** Tamanho de cada pedaço do upload de vídeo (abaixo do upload_max_filesize de 2 MB por defeito do PHP). */
    public const VIDEO_CHUNK_BYTES = 1536 * 1024;

    /** Tipos de anexo das aulas (extensões; o tipo real do ficheiro é confirmado ao carregar). */
    public const ATTACHMENT_TYPES = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'zip'];

    /** Curso no formato do editor (React). */
    public function toEditor(Course $course): array
    {
        $course->load(['modules.lessons.attachments', 'modules.lessons.checks', 'modules.lessons.quiz.questions.options', 'finalQuiz.questions.options']);

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
            'deadline_days' => $course->deadline_days,
            'requires_attendance' => (bool) $course->requires_attendance,
            'alex_enabled' => (bool) $course->alex_enabled,
            'alex_pal_id' => $course->alex_pal_id ?? '',
            'alex_face_id' => $course->alex_face_id ?? '',
            'alex_blocked' => (bool) $course->alex_blocked,
            'certificate_enabled' => $course->certificate_enabled,
            'certificate_min_progress' => $course->certificate_min_progress,
            'certificate_min_score' => $course->certificate_min_score,
            // Avaliação final do curso (fase 2, 2026-11-27)
            'final_mode' => $course->finalMode(),
            'final_pass' => (int) ($course->final_pass ?: 70),
            'final_minutes' => (int) ($course->final_minutes ?: 15),
            'final_prompt' => $course->final_prompt ?? '',
            'final_pal_id' => $course->final_pal_id ?? '',
            'final_weight' => (int) $course->final_weight,
            'final_weighted' => (bool) $course->finalQuiz?->weighted,
            'final_quiz' => $course->finalQuiz ? $this->questionsToEditor($course->finalQuiz) : [],
            'modules' => $course->modules->map(fn (Module $m) => [
                'key' => 'm'.$m->id,
                'id' => $m->id,
                'title' => $m->title,
                'description' => $m->description ?? '',
                'alex_pal_id' => $m->alex_pal_id ?? '',
                'alex_face_id' => $m->alex_face_id ?? '',
                'lessons' => $m->lessons->map(fn (Lesson $l) => [
                    'key' => 'l'.$l->id,
                    'id' => $l->id,
                    'title' => $l->title,
                    'type' => $l->content_type,
                    'kind' => $l->kindName(),
                    // O avatar deixou de ser uma parte da aula (é o avatar de ajuda do curso)
                    'parts' => array_values(array_diff($l->setRelation('module', $m->setRelation('course', $course))->partList(), ['avatar'])),
                    'roleplay_role' => $l->roleplay_role ?? '',
                    'graded' => (bool) $l->graded,
                    'avatar_link' => $l->avatar_ref ?? '',
                    'weighted' => (bool) $l->quiz?->weighted,
                    'evaluation' => $l->evaluationKind(),
                    'evaluation_prompt' => $l->evaluation_prompt ?? '',
                    'evaluation_pal_id' => $l->evaluation_pal_id ?? '',
                    // Só o vídeo: o avatar já não usa este campo (antes partilhavam-no e o link do vídeo aparecia no avatar)
                    'url' => $l->content_url ?? '',
                    'minutes' => $l->duration_seconds ? (int) round($l->duration_seconds / 60) : '',
                    'body' => $l->body ?? '',
                    'attachments' => $l->attachments->map(fn (LessonAttachment $a) => [
                        'name' => $a->name, 'path' => $a->path, 'size' => $a->size, 'url' => $a->url(),
                    ])->values()->all(),
                    'quiz' => $l->quiz ? $this->questionsToEditor($l->quiz) : [],
                    'checks' => $l->checks->map(fn ($c) => [
                        'key' => 'c'.$c->id, 'id' => $c->id,
                        'question' => $c->question, 'options' => $c->options, 'correct' => $c->correct, 'explanation' => $c->explanation ?? '',
                    ])->values()->all(),
                ])->values()->all(),
            ])->values()->all(),
        ];
    }

    /** Perguntas de um questionário no formato do editor (com o peso de cada uma). */
    private function questionsToEditor(\App\Models\Quiz $quiz): array
    {
        return $quiz->questions->map(fn ($q) => [
            'key' => 'q'.$q->id,
            'id' => $q->id,
            'question' => $q->question,
            'points' => (int) ($q->points ?: 1),
            'option_ids' => $q->options->pluck('id')->all(),
            'options' => $q->options->pluck('option_text')->all(),
            'correct' => max(0, $q->options->search(fn ($o) => $o->is_correct)),
        ])->values()->all();
    }

    /**
     * Guarda o estado do editor. Devolve ['modules' => [key => id], 'lessons' => [key => id],
     * 'questions' => [key => ['id', 'option_ids']], 'checks' => [key => id]].
     */
    public function save(Course $course, array $data, ?int $uploaderId = null): array
    {
        $this->uploaderId = $uploaderId;

        // O que já faltava antes desta gravação (num curso publicado): não volta a bloquear a gravação
        $missingBefore = $course->exists && $course->status === 'published'
            ? collect($this->publishProblems($course->fresh()))->pluck(0)
            : collect();

        return DB::transaction(function () use ($course, $data, $missingBefore) {
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
                'deadline_days' => $data['deadline_days'] ?? null,
                'requires_attendance' => (bool) ($data['requires_attendance'] ?? false),
                'certificate_enabled' => (bool) ($data['certificate_enabled'] ?? true),
                'certificate_min_progress' => $data['certificate_min_progress'] ?? 100,
                'certificate_min_score' => $data['certificate_min_score'] ?? 70,
            ]);
            // Avatar (Alex): o controlador só deixa passar estes campos a quem os pode mudar
            if (array_key_exists('alex_enabled', $data)) {
                $course->fill([
                    'alex_enabled' => (bool) $data['alex_enabled'],
                    'alex_pal_id' => ($data['alex_pal_id'] ?? null) ?: null,
                    'alex_face_id' => ($data['alex_face_id'] ?? null) ?: null,
                ]);
            }
            if (array_key_exists('alex_blocked', $data)) {
                $course->alex_blocked = (bool) $data['alex_blocked'];
            }
            if ($course->alex_blocked) {
                $course->alex_enabled = false; // bloqueado pela equipa: fica desligado
            }

            // O endereço só muda enquanto o curso não está publicado (links partilhados não partem)
            if ($course->status !== 'published' || ! $course->slug) {
                $course->slug = $this->uniqueSlug($title ?: 'curso-'.Str::lower(Str::random(6)), $course->id);
            }
            $course->save();

            $maps = ['modules' => [], 'lessons' => [], 'questions' => [], 'checks' => []];
            $existingModules = $course->modules()->get()->keyBy('id');
            $existingLessons = Lesson::whereIn('module_id', $existingModules->keys())->get()->keyBy('id');
            $oldVideos = $existingLessons->toBase()->map(fn (Lesson $l) => self::uploadedVideo($l->content_url))->filter();
            $keptModules = [];
            $keptLessons = [];
            $minutes = 0;

            foreach (array_values($data['modules'] ?? []) as $mi => $m) {
                $module = isset($m['id']) && $existingModules->has($m['id'])
                    ? $existingModules[$m['id']]
                    : new Module(['course_id' => $course->id]);
                $module->fill(['title' => trim($m['title'] ?? ''), 'description' => $m['description'] ?? null, 'order_index' => $mi]);
                // O Alex do módulo: só quem pode mudar o Alex do curso (o controlador tira os campos aos outros)
                if (array_key_exists('alex_enabled', $data)) {
                    $module->fill(['alex_pal_id' => ($m['alex_pal_id'] ?? null) ?: null, 'alex_face_id' => ($m['alex_face_id'] ?? null) ?: null]);
                }
                $module->course_id = $course->id;
                $module->save();
                $keptModules[] = $module->id;
                $maps['modules'][$m['key']] = $module->id;

                foreach (array_values($m['lessons'] ?? []) as $li => $l) {
                    $lesson = isset($l['id']) && $existingLessons->has($l['id']) ? $existingLessons[$l['id']] : new Lesson;
                    // Editor aberto antes das partes (só com o tipo): as partes vêm do tipo, como na migração
                    if (! array_key_exists('parts', $l) && ! array_key_exists('kind', $l)) {
                        $old = (new Lesson(['content_type' => $l['type'] ?? 'video_link']))->setRelation('module', null);
                        $l['parts'] = $old->partList();
                        $l['evaluation'] = $old->evaluationKind();
                    }
                    // Editor aberto antes da fase 2 (sem o tipo): o teste sozinho é um Teste; o resto é uma Aula
                    if (! array_key_exists('kind', $l)) {
                        $l['kind'] = ($l['evaluation'] ?? 'none') !== 'none' && ! array_diff((array) $l['parts'], ['avatar']) ? 'teste' : 'aula';
                    }
                    // Tipo de atividade (fase 2): o que cada uma guarda está em Lesson (ver a migração de 2026-11-27)
                    $kind = in_array($l['kind'] ?? 'aula', Lesson::KINDS, true) ? ($l['kind'] ?? 'aula') : 'aula';
                    $parts = $kind === 'aula' ? array_values(array_intersect(Lesson::PARTS, (array) ($l['parts'] ?? []))) : [];
                    $evaluation = match ($kind) {
                        'teste' => ($l['evaluation'] ?? 'quiz') === 'avatar' ? 'avatar' : 'quiz',
                        'exercicio' => ($l['evaluation'] ?? 'none') === 'quiz' ? 'quiz' : 'none',
                        'roleplay' => 'avatar',
                        default => 'none',
                    };
                    $withAvatar = $evaluation === 'avatar'; // teste com avatar ou roleplay
                    $hasVideo = in_array('video', $parts, true);
                    $url = trim($l['url'] ?? '');
                    $link = trim($l['avatar_link'] ?? '');
                    $lesson->fill([
                        'module_id' => $module->id,
                        'kind' => $kind,
                        'title' => trim($l['title'] ?? ''),
                        'parts' => $parts,
                        'evaluation' => $evaluation,
                        // Casos do teste com avatar / instruções do roleplay (o aluno não vê)
                        'evaluation_prompt' => $withAvatar ? (trim($l['evaluation_prompt'] ?? '') ?: null) : null,
                        'roleplay_role' => $kind === 'roleplay' ? (trim($l['roleplay_role'] ?? '') ?: null) : null,
                        'graded' => $kind === 'roleplay' ? (bool) ($l['graded'] ?? false) : true,
                        'content_type' => Lesson::mainType($parts, $evaluation, $lesson->content_type),
                        'content_url' => $hasVideo ? ($url ?: null) : null,
                        // Notas da aula, o que o aluno faz no exercício prático, ou a situação do roleplay
                        'body' => in_array('notas', $parts, true) || $kind === 'roleplay' || ($kind === 'exercicio' && $evaluation === 'none') ? ($l['body'] ?? null) : null,
                        // Avatar por link (teste com avatar ou roleplay); só https dos sites aceites
                        'avatar_ref' => $withAvatar && self::validAvatarUrl($link) ? $link : null,
                        'duration_seconds' => (int) ($l['minutes'] ?? 0) * 60,
                        'order_index' => $li,
                    ]);
                    // PAL do avatar desta atividade: só quem pode mudar o avatar do curso (como o PAL dos módulos)
                    if (array_key_exists('alex_enabled', $data)) {
                        $lesson->evaluation_pal_id = $withAvatar ? (($l['evaluation_pal_id'] ?? null) ?: null) : null;
                    }
                    $lesson->save();
                    $keptLessons[] = $lesson->id;
                    $maps['lessons'][$l['key']] = $lesson->id;
                    $minutes += (int) ($l['minutes'] ?? 0);

                    $this->syncAttachments($lesson, $l['attachments'] ?? []);
                    $maps['questions'] += $this->syncQuiz($lesson, $evaluation === 'quiz' ? ($l['quiz'] ?? []) : null, (bool) ($l['weighted'] ?? false), $kind !== 'exercicio');
                    $maps['checks'] += $this->syncChecks($lesson, $hasVideo ? ($l['checks'] ?? []) : []);
                }
            }

            // Removidos no editor
            $existingLessons->except($keptLessons)->each(function (Lesson $l) {
                $this->syncAttachments($l, []);
                $l->delete();
            });
            $existingModules->except($keptModules)->each->delete();

            // Vídeos carregados que deixaram de ser usados (aula apagada ou vídeo trocado) saem do disco
            // (só depois de a gravação ser confirmada)
            $unused = $oldVideos->diff(Lesson::whereNotNull('content_url')->pluck('content_url')->map(fn ($u) => self::uploadedVideo($u))->filter());
            DB::afterCommit(fn () => $unused->each(fn ($path) => CourseFiles::delete($path)));

            $this->saveFinal($course, $data, $maps);

            $course->forceFill([
                'duration_minutes' => $minutes,
            ])->save();

            // Um curso publicado não fica mais incompleto no catálogo: se esta gravação deixar a faltar alguma
            // coisa nova, é recusada (o editor mostra o aviso e guarda quando estiver completo). O que já faltava
            // antes (por ex. um vídeo que não ficou no servidor) não bloqueia: senão nada se gravava, nem anexos.
            $new = $course->status === 'published'
                ? collect($this->publishProblems($course))->pluck(0)->diff($missingBefore)
                : collect();
            if ($new->isNotEmpty()) {
                throw ValidationException::withMessages(['course' => __('Este curso está publicado e não pode ficar incompleto. Falta: :items. Completa-o ou passa-o a rascunho para gravar.', [
                    'items' => $new->implode(', '),
                ])]);
            }

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

        if (! trim($course->title)) $problems[] = [__('Título do curso'), 0];
        if (! $course->category_id || ! $course->level) $problems[] = [__('Área e nível'), 0];
        if (! $course->thumbnail_url) $problems[] = [__('Imagem de capa'), 0];
        if (! trim((string) $course->short_description) || mb_strlen($course->short_description) > self::SHORT_MAX) {
            $problems[] = [__('Descrição curta'), 0];
        }
        if ($lessons->isEmpty()) $problems[] = [__('Pelo menos 1 módulo com 1 aula'), 1];
        if ($course->modules->contains(fn ($m) => ! trim($m->title))) $problems[] = [__('Todos os módulos têm título'), 1];
        if ($lessons->contains(fn ($l) => ! $this->lessonComplete($l))) {
            $problems[] = [__('Todas as aulas completas (título + link/conteúdo)'), 1];
        }
        // Sem os minutos, o vídeo não conclui a aula (o aluno ficava preso; ver LearningService::videoReady)
        if ($lessons->contains(fn ($l) => $l->hasPart('video') && (int) $l->duration_seconds <= 0)) {
            $problems[] = [__('Minutos em todas as aulas de vídeo'), 1];
        }
        // Avaliação final com perguntas: tem de ter perguntas prontas (passo 4)
        if ($course->finalMode() === 'questions' && ! self::quizReady($course->finalQuiz()->with('questions.options')->first())) {
            $problems[] = [__('Perguntas da avaliação final'), 3];
        }
        if (! $course->is_free && (float) $course->price <= 0) $problems[] = [__('Preço definido'), 4];

        return $problems;
    }

    public function lessonComplete(Lesson $l): bool
    {
        if (! trim($l->title)) return false;
        if ($l->content_type === 'live') return true; // aulas antigas do backoffice

        $parts = $l->partList();
        $evaluation = $l->evaluationKind();
        // Cada parte ligada tem de ter o seu conteúdo; o avatar e a avaliação com o avatar não pedem nada (PAL opcional)
        $checks = [
            'video' => fn () => self::validUrl($l->content_url) || self::uploadedVideo($l->content_url),
            'material' => fn () => $l->attachments->isNotEmpty(),
            'notas' => fn () => trim(strip_tags((string) $l->body)) !== '',
            'avatar' => fn () => true,
        ];
        foreach ($parts as $part) {
            if (! $checks[$part]()) return false;
        }
        if ($evaluation === 'quiz') {
            return self::quizReady($l->quiz);
        }

        return match ($l->kindName()) {
            'teste' => true, // teste com avatar: o avatar e os casos são opcionais
            'roleplay' => trim((string) $l->body) !== '' && trim((string) $l->roleplay_role) !== '', // situação e papel
            'exercicio' => trim(strip_tags((string) $l->body)) !== '', // o que o aluno tem de fazer
            default => $parts !== [], // uma aula vazia não está completa
        };
    }

    /** Cada pergunta: texto, 2 opções com texto e a opção certa com texto (senão ninguém a podia acertar). */
    public static function quizReady(?\App\Models\Quiz $quiz): bool
    {
        return $quiz && $quiz->questions->isNotEmpty() && $quiz->questions->every(
            fn ($q) => trim($q->question) && $q->options->filter(fn ($o) => trim($o->option_text))->count() >= 2
                && $q->options->contains(fn ($o) => $o->is_correct && trim($o->option_text) !== '')
        );
    }

    public static function validUrl(?string $url): bool
    {
        return (bool) filter_var($url, FILTER_VALIDATE_URL) && preg_match('#^https?://#i', $url);
    }

    /** Link de avatar: https e num dos sites aceites (config tacademy.avatar_hosts, também os subdomínios). */
    public static function validAvatarUrl(?string $url): bool
    {
        if (! self::validUrl($url) || ! str_starts_with(strtolower((string) $url), 'https://')) {
            return false;
        }
        $host = strtolower((string) parse_url((string) $url, PHP_URL_HOST));
        foreach (config('tacademy.avatar_hosts', []) as $allowed) {
            $allowed = strtolower($allowed);
            if ($host === $allowed || str_ends_with($host, '.'.$allowed)) {
                return true;
            }
        }

        return false;
    }

    /** Caminho no disco public de um vídeo carregado pelo formador (/storage/cursos/videos/…), ou null. */
    public static function uploadedVideo(?string $url): ?string
    {
        return preg_match('#^/storage/('.preg_quote(self::VIDEO_DIR, '#').'/[\w-]+\.(mp4|webm))$#', (string) $url, $m) ? $m[1] : null;
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
            if ($current->has($path)) {
                $keep[] = $path;
                $current[$path]->update(['order_index' => $i]);
                continue;
            }
            // Anexo novo: só um ficheiro que esta pessoa carregou agora (a sua pasta, sem "..").
            // Sem isto, indicar o caminho de um anexo de outro curso e retirá-lo depois apagava o ficheiro desse curso.
            $mine = $this->uploaderId
                && preg_match('#^'.preg_quote(self::UPLOAD_DIR.'/'.self::attachmentDir($this->uploaderId), '#').'/[\w.\-]+$#', $path)
                && ! str_contains($path, '..');
            if (! $mine) continue;
            $keep[] = $path;
            if (CourseFiles::exists($path)) {
                $lesson->attachments()->create([
                    'name' => Str::limit($a['name'] ?? basename($path), 195, ''),
                    'path' => $path,
                    'size' => CourseFiles::size($path),
                    'order_index' => $i,
                ]);
            }
        }
        // Pelo caminho (o except() de uma coleção Eloquent compara ids, não chaves: apagava todos os anexos que já existiam)
        $current->reject(fn (LessonAttachment $a) => in_array($a->path, $keep, true))->each(function (LessonAttachment $a) {
            $a->delete();
            // Ficheiros do projeto não se apagam; os outros só depois de a gravação ser confirmada (pode ser recusada)
            // e só se nenhuma outra aula usar o mesmo ficheiro
            if (! str_starts_with($a->path, '/')) {
                $path = $a->path;
                DB::afterCommit(function () use ($path) {
                    if (! LessonAttachment::where('path', $path)->exists()) CourseFiles::delete($path);
                });
            }
        });
    }

    /**
     * Guarda as perguntas rápidas do fim da aula (só aulas de vídeo; perguntas vazias são ignoradas).
     * As que já existem são atualizadas pelo id, para não perder as respostas dos alunos
     * (lesson_progress.check_answers guarda o id da pergunta). Devolve [key => id].
     */
    private function syncChecks(Lesson $lesson, array $checks): array
    {
        $existing = $lesson->checks()->get()->keyBy('id');
        $kept = [];
        $map = [];
        foreach (array_values(array_filter($checks, fn ($c) => trim($c['question'] ?? '') !== '')) as $i => $c) {
            $options = array_values(array_filter(array_map(fn ($o) => trim((string) $o), $c['options'] ?? []), fn ($o) => $o !== ''));
            if (count($options) < 2) continue;
            $check = isset($c['id']) && $existing->has($c['id']) ? $existing[$c['id']] : $lesson->checks()->make();
            $check->fill([
                'question' => trim($c['question']),
                'options' => $options,
                'correct' => min((int) ($c['correct'] ?? 0), count($options) - 1),
                'explanation' => trim($c['explanation'] ?? '') ?: null,
                'order_index' => $i,
            ])->save();
            $kept[] = $check->id;
            if (! empty($c['key'])) $map[$c['key']] = $check->id;
        }
        $lesson->checks()->whereNotIn('id', $kept)->delete();

        return $map;
    }

    /**
     * Guarda as perguntas do quiz da aula (null = a aula já não é quiz).
     * Perguntas e opções que já existem são atualizadas pelo id, porque as tentativas dos alunos
     * (quiz_attempts.answers = {question_id: option_id}) apontam para esses ids.
     * Devolve [key => ['id' => id da pergunta, 'option_ids' => [...]]].
     */
    private function syncQuiz(Lesson $lesson, ?array $questions, bool $weighted = false, bool $graded = true): array
    {
        return $this->syncQuestions($lesson->quiz(), $lesson->title ?: 'Teste', $questions, $weighted, $graded, $lesson->title);
    }

    /** Avaliação final do curso: modo, nota mínima, duração, o que o avatar avalia, peso e as perguntas. */
    private function saveFinal(Course $course, array $data, array &$maps): void
    {
        if (! array_key_exists('final_mode', $data)) return; // editor aberto antes da fase 2
        $mode = in_array($data['final_mode'], ['questions', 'avatar', 'none'], true) ? $data['final_mode'] : 'none';
        $course->fill([
            'final_mode' => $mode,
            'final_pass' => max(0, min(100, (int) ($data['final_pass'] ?? 70))),
            'final_minutes' => max(1, min(120, (int) ($data['final_minutes'] ?? 15))),
            'final_prompt' => $mode === 'avatar' ? (trim($data['final_prompt'] ?? '') ?: null) : null,
            'final_weight' => max(0, min(100, (int) ($data['final_weight'] ?? 50))),
        ]);
        if (array_key_exists('alex_enabled', $data)) {
            $course->final_pal_id = $mode === 'avatar' ? (($data['final_pal_id'] ?? null) ?: null) : null;
        }
        $course->save();
        // As perguntas ficam guardadas mesmo noutro modo, se já houver tentativas (as notas dos alunos não se perdem)
        $maps['questions'] += $this->syncQuestions(
            $course->finalQuiz(), 'Avaliação final', $mode === 'questions' ? ($data['final_quiz'] ?? []) : null,
            (bool) ($data['final_weighted'] ?? false), true, null, ['course_id' => $course->id, 'passing_score' => $course->final_pass],
        );
    }

    private function syncQuestions($relation, string $title, ?array $questions, bool $weighted, bool $graded, ?string $lessonTitle, array $extra = []): array
    {
        $quiz = $relation->first();
        if ($questions === null) {
            if (! $quiz) return [];
            // Apagar o quiz apagava também as tentativas, e com elas as notas do certificado
            if (QuizAttempt::where('quiz_id', $quiz->id)->exists()) {
                if ($lessonTitle === null) return []; // avaliação final: fica guardada
                throw ValidationException::withMessages(['modules' => __('A aula ":title" é um teste que já tem tentativas de alunos. Não podes mudar o tipo desta aula.', ['title' => $lessonTitle ?: __('Teste')])]);
            }
            $quiz->delete();

            return [];
        }
        $quiz ??= $relation->create(['title' => $title] + $extra);
        $quiz->update(['title' => $title, 'weighted' => $weighted, 'graded' => $graded] + $extra);

        $existing = $quiz->questions()->with('options')->get()->keyBy('id');
        $kept = [];
        $map = [];
        foreach (array_values($questions) as $qi => $q) {
            $question = isset($q['id']) && $existing->has($q['id']) ? $existing[$q['id']] : $quiz->questions()->make();
            $question->fill(['question' => trim($q['question'] ?? ''), 'points' => max(1, min(100, (int) ($q['points'] ?? 1))), 'order_index' => $qi])->save();
            $kept[] = $question->id;

            // Opções: pelo id que o editor envia; sem ids (editor aberto antes desta versão), pela posição
            $old = $question->relationLoaded('options') ? $question->options->values() : collect();
            $byId = $old->keyBy('id');
            $sentIds = $q['option_ids'] ?? null;
            $optionIds = [];
            foreach (array_values($q['options'] ?? []) as $oi => $text) {
                $id = is_array($sentIds) ? ($sentIds[$oi] ?? null) : $old->get($oi)?->id;
                $option = $id && $byId->has($id) && ! in_array($id, $optionIds, true) ? $byId[$id] : $question->options()->make();
                $option->fill(['option_text' => trim((string) $text), 'is_correct' => $oi === (int) ($q['correct'] ?? 0)])->save();
                $optionIds[] = $option->id;
            }
            $question->options()->whereNotIn('id', $optionIds)->delete();
            if (! empty($q['key'])) $map[$q['key']] = ['id' => $question->id, 'option_ids' => $optionIds];
        }
        $quiz->questions()->whereNotIn('id', $kept)->delete(); // as opções vão em cascata

        return $map;
    }
}
