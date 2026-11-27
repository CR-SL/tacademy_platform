<?php

namespace App\Models;

use App\Models\Concerns\HasUlid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Lesson extends Model
{
    use HasUlid, SoftDeletes;

    protected $fillable = [
        'module_id',
        'kind',
        'roleplay_role',
        'graded',
        'title',
        'content_type',
        'parts',
        'evaluation',
        'evaluation_prompt',
        'content_url',
        'avatar_ref',
        'evaluation_pal_id',
        'body',
        'duration_seconds',
        'order_index',
    ];

    /** O que uma aula pode ter (o formador liga cada um no editor) e as avaliações possíveis. */
    public const PARTS = ['video', 'material', 'notas'];

    public const EVALUATIONS = ['none', 'quiz', 'avatar'];

    /** Tipos de atividade de um módulo (fase 2, 2026-11-27). */
    public const KINDS = ['aula', 'exercicio', 'teste', 'roleplay'];

    public function kindName(): string
    {
        return in_array($this->kind, self::KINDS, true) ? $this->kind : 'aula';
    }

    /** Atividade com avatar (teste com avatar ou roleplay): faz-se na caixa do avatar. */
    public function usesAvatar(): bool
    {
        return $this->kindName() === 'roleplay' || ($this->kindName() === 'teste' && $this->evaluationKind() === 'avatar');
    }

    protected function casts(): array
    {
        return [
            'duration_seconds' => 'integer',
            'parts' => 'array',
            'graded' => 'boolean',
        ];
    }

    /**
     * Partes ligadas nesta aula. Aulas sem partes gravadas (criadas por seeders) usam o tipo antigo.
     * O avatar de ajuda é do curso (alex_enabled), não uma parte da aula.
     */
    public function partList(): array
    {
        if (is_array($this->parts)) {
            return array_values(array_intersect(self::PARTS, $this->parts));
        }
        $parts = match ($this->content_type) {
            'video_link', 'video_upload' => ['video'],
            'document' => ['material'],
            'text' => ['notas'],
            default => [],
        };

        return $parts;
    }

    public function hasPart(string $part): bool
    {
        return in_array($part, $this->partList(), true);
    }

    /** none | quiz | avatar (aulas antigas: o teste é a avaliação). */
    public function evaluationKind(): string
    {
        return in_array($this->evaluation, self::EVALUATIONS, true)
            ? $this->evaluation
            : ($this->content_type === 'quiz' ? 'quiz' : 'none');
    }

    /** Tipo principal, gravado em content_type para o catálogo, o programa e as aulas antigas. */
    public static function mainType(array $parts, string $evaluation, ?string $previous = null): string
    {
        return match (true) {
            $evaluation === 'quiz' => 'quiz',
            in_array('video', $parts, true) => $previous === 'video_upload' ? 'video_upload' : 'video_link',
            $evaluation === 'avatar' => 'avatar',
            in_array('material', $parts, true) => 'document',
            in_array('notas', $parts, true) => 'text',
            $previous === 'live' => 'live',
            default => 'text',
        };
    }

    public function module(): BelongsTo
    {
        return $this->belongsTo(Module::class);
    }

    /** Documento da aula ou materiais de apoio (PDF, esquemas, fichas técnicas). */
    public function attachments(): HasMany
    {
        return $this->hasMany(LessonAttachment::class)->orderBy('order_index');
    }

    /** Perguntas rápidas do fim da aula (aulas de vídeo). */
    public function checks(): HasMany
    {
        return $this->hasMany(LessonCheck::class)->orderBy('order_index');
    }

    public function quiz(): HasOne
    {
        return $this->hasOne(Quiz::class);
    }
}
