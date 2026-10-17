<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class QuizOption extends Model
{
    public $timestamps = false;

    protected $fillable = ['question_id', 'option_text', 'is_correct'];

    protected function casts(): array
    {
        return ['is_correct' => 'boolean'];
    }
}
