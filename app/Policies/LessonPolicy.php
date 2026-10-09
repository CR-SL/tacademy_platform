<?php

namespace App\Policies;

use App\Models\Lesson;
use App\Models\User;

/**
 * O formador gere as lições dos cursos de que é instrutor.
 * O admin passa pelo Gate::before.
 */
class LessonPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRole('formador');
    }

    public function view(User $user, Lesson $lesson): bool
    {
        return $user->hasRole('formador');
    }

    public function create(User $user): bool
    {
        return $user->hasRole('formador');
    }

    public function update(User $user, Lesson $lesson): bool
    {
        return $user->id === $lesson->module?->course?->instructor_id;
    }

    public function delete(User $user, Lesson $lesson): bool
    {
        return $user->id === $lesson->module?->course?->instructor_id;
    }
}
