<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LessonNote extends Model
{
    protected $fillable = ['user_id', 'lesson_id', 'position_seconds', 'body'];

    protected function casts(): array
    {
        return ['position_seconds' => 'integer'];
    }
}
