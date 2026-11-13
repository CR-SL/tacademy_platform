<?php

namespace App\Models;

use App\Models\Concerns\HasUlid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Uma conversa com o Alex (Tavus). O `tavus_id` é o conversation_id do Tavus. */
class AlexConversation extends Model
{
    use HasUlid;

    protected $fillable = ['user_id', 'course_id', 'lesson_id', 'place', 'tavus_id', 'status', 'end_reason', 'ended_at', 'transcript'];

    protected function casts(): array
    {
        return [
            'ended_at' => 'datetime',
            'transcript' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    public function lesson(): BelongsTo
    {
        return $this->belongsTo(Lesson::class);
    }

    /** Segundos de conversa (até agora, se ainda estiver a decorrer). */
    public function seconds(): int
    {
        return (int) $this->created_at?->diffInSeconds($this->ended_at ?? now());
    }
}
