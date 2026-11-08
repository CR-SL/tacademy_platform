<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Uma abertura de um curso no catálogo (estatísticas de cliques). */
class CourseView extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['course_id', 'user_id'];

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }
}
