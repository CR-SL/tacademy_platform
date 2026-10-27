<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LessonProgress extends Model
{
    protected $table = 'lesson_progress';

    // A tabela só tem updated_at (sem created_at).
    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'lesson_id',
        'status',
        'progress_percent',
        'last_position_seconds',
        'watched_map',
        'watched_seconds',
        'video_duration_seconds',
        'check_answers',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'completed_at' => 'datetime',
            'progress_percent' => 'integer',
            'last_position_seconds' => 'integer',
            'watched_seconds' => 'integer',
            'video_duration_seconds' => 'integer',
            'check_answers' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function lesson(): BelongsTo
    {
        return $this->belongsTo(Lesson::class);
    }
}
