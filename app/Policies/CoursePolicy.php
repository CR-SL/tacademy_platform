<?php

namespace App\Policies;

use App\Models\Course;
use App\Models\User;

/**
 * Cursos no editor, pelas permissões do perfil (Administração › Permissões):
 * "cursos.criar" vê a lista e cria, e edita/apaga os cursos de que é instrutor;
 * "cursos.todos" edita qualquer curso. O admin passa pelo Gate::before.
 */
class CoursePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->canDo('cursos.criar') || $user->canDo('cursos.todos');
    }

    public function view(User $user, Course $course): bool
    {
        return $this->viewAny($user);
    }

    public function create(User $user): bool
    {
        return $user->canDo('cursos.criar') || $user->canDo('cursos.todos');
    }

    public function update(User $user, Course $course): bool
    {
        return $user->canDo('cursos.todos') || ($user->canDo('cursos.criar') && $user->id === $course->instructor_id);
    }

    /** Publicar: o próprio curso com "cursos.publicar", ou qualquer um com "cursos.todos". */
    public function publish(User $user, Course $course): bool
    {
        return $user->canDo('cursos.todos') || ($user->canDo('cursos.publicar') && $user->id === $course->instructor_id);
    }

    public function delete(User $user, Course $course): bool
    {
        return $this->update($user, $course);
    }
}
