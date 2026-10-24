<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Pergunta rápida no fim de uma aula de vídeo (mini-quiz para fixar a matéria).
 * O aluno tem de responder para concluir a aula, mas não precisa de acertar; não conta para a nota.
 */
class LessonCheck extends Model
{
    protected $fillable = ['lesson_id', 'question', 'options', 'correct', 'explanation', 'order_index', 'ai_generated'];

    protected function casts(): array
    {
        return ['options' => 'array', 'correct' => 'integer', 'ai_generated' => 'boolean'];
    }

    public function lesson(): BelongsTo
    {
        return $this->belongsTo(Lesson::class);
    }
}
