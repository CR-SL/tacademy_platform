<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class LessonAttachment extends Model
{
    protected $fillable = ['lesson_id', 'name', 'path', 'size', 'order_index'];

    protected function casts(): array
    {
        return ['size' => 'integer'];
    }

    public function lesson(): BelongsTo
    {
        return $this->belongsTo(Lesson::class);
    }

    public function url(): string
    {
        // Caminho começado por "/" = ficheiro fixo do projeto em public/ (ex.: materiais do curso de demonstração)
        return str_starts_with($this->path, '/') ? $this->path : Storage::disk('public')->url($this->path);
    }
}
