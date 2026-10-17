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
        'title',
        'content_type',
        'content_url',
        'avatar_ref',
        'body',
        'duration_seconds',
        'order_index',
        'is_downloadable',
    ];

    protected function casts(): array
    {
        return [
            'is_downloadable' => 'boolean',
            'duration_seconds' => 'integer',
        ];
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

    public function quiz(): HasOne
    {
        return $this->hasOne(Quiz::class);
    }
}
