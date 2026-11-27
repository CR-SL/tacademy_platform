<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Quiz extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['lesson_id', 'course_id', 'title', 'passing_score', 'max_attempts', 'weighted', 'graded'];

    protected function casts(): array
    {
        return ['weighted' => 'boolean', 'graded' => 'boolean'];
    }

    /** Avaliação final do curso (as perguntas ficam no curso, não numa aula). */
    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    /**
     * Nota de 0 a 100 de uma tentativa (2026-11-27): por defeito os 100% repartem-se por igual entre as perguntas;
     * com pesos, cada pergunta vale os seus pontos a dividir pelo total. $right = [question_id => true/false].
     */
    public function scoreOf(array $right): int
    {
        $questions = $this->questions;
        $total = $this->weighted ? $questions->sum(fn ($q) => max(0, (int) $q->points)) : $questions->count();
        if ($total <= 0) return 0;
        $got = $questions->sum(fn ($q) => ($right[$q->id] ?? false) ? ($this->weighted ? max(0, (int) $q->points) : 1) : 0);

        return (int) round($got / $total * 100);
    }

    public function lesson(): BelongsTo
    {
        return $this->belongsTo(Lesson::class);
    }

    public function questions(): HasMany
    {
        return $this->hasMany(QuizQuestion::class)->orderBy('order_index');
    }
}
