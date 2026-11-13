<?php

namespace App\Models;

use App\Models\Concerns\HasUlid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use Illuminate\Database\Eloquent\SoftDeletes;

class Course extends Model
{
    use HasUlid, SoftDeletes;

    /** Níveis do curso e o nome de cada um (o editor de cursos tem os mesmos em levelLabels, format.js). */
    public const LEVELS = ['iniciante' => 'Iniciante', 'intermedio' => 'Intermédio', 'avancado' => 'Avançado'];

    protected $fillable = [
        'category_id',
        'instructor_id',
        'title',
        'slug',
        'description',
        'short_description',
        'learning_outcomes',
        'prerequisites',
        'audience',
        'level',
        'duration_minutes',
        'thumbnail_url',
        'status',
        'price',
        'is_free',
        'currency',
        'access_months',
        'deadline_days',
        'certificate_enabled',
        'certificate_min_progress',
        'certificate_min_score',
        'requires_attendance',
        'alex_enabled',
        'alex_pal_id',
        'alex_face_id',
        'alex_blocked',
        'sample_lesson_id',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'duration_minutes' => 'integer',
            'learning_outcomes' => 'array',
            'is_free' => 'boolean',
            'access_months' => 'integer',
            'deadline_days' => 'integer',
            'requires_attendance' => 'boolean',
            'alex_enabled' => 'boolean',
            'alex_blocked' => 'boolean',
            'certificate_enabled' => 'boolean',
            'certificate_min_progress' => 'integer',
            'certificate_min_score' => 'integer',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function instructor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'instructor_id');
    }

    public function modules(): HasMany
    {
        return $this->hasMany(Module::class)->orderBy('order_index');
    }

    /** Todas as lições do curso (através dos módulos) — usado p/ detetar lições de IA. */
    public function lessons(): HasManyThrough
    {
        return $this->hasManyThrough(Lesson::class, Module::class);
    }

    public function enrollments(): HasMany
    {
        return $this->hasMany(Enrollment::class);
    }
}
