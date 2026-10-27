<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Tentativa de um quiz: nota, se passou e as respostas dadas (só de leitura depois de entregue). */
class QuizAttempt extends Model
{
    public $timestamps = false;

    protected $fillable = ['user_id', 'quiz_id', 'score', 'passed', 'answers', 'attempted_at'];

    protected function casts(): array
    {
        return ['score' => 'integer', 'passed' => 'boolean', 'answers' => 'array', 'attempted_at' => 'datetime'];
    }

    public function quiz(): BelongsTo
    {
        return $this->belongsTo(Quiz::class);
    }
}
