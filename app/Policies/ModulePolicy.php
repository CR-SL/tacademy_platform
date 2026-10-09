<?php

namespace App\Policies;

use App\Models\Module;
use App\Models\User;

/**
 * O formador gere os módulos dos cursos de que é instrutor.
 * O admin passa pelo Gate::before.
 */
class ModulePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRole('formador');
    }

    public function view(User $user, Module $module): bool
    {
        return $user->hasRole('formador');
    }

    public function create(User $user): bool
    {
        return $user->hasRole('formador');
    }

    public function update(User $user, Module $module): bool
    {
        return $user->id === $module->course?->instructor_id;
    }

    public function delete(User $user, Module $module): bool
    {
        return $user->id === $module->course?->instructor_id;
    }
}
