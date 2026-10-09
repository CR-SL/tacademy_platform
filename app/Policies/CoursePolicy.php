<?php

namespace App\Policies;

use App\Models\Course;
use App\Models\User;

/**
 * O formador vê a lista de cursos e cria novos, mas só edita/apaga os
 * cursos de que é instrutor. O admin passa pelo Gate::before.
 */
class CoursePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRole('formador');
    }

    public function view(User $user, Course $course): bool
    {
        return $user->hasRole('formador');
    }

    public function create(User $user): bool
    {
        return $user->hasRole('formador');
    }

    public function update(User $user, Course $course): bool
    {
        return $user->id === $course->instructor_id;
    }

    public function delete(User $user, Course $course): bool
    {
        return $user->id === $course->instructor_id;
    }
}
