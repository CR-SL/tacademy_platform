<?php

namespace App\Policies;

use App\Models\Category;
use App\Models\User;

/**
 * Categorias são geridas apenas por admin. O admin passa pelo Gate::before
 * (AppServiceProvider), por isso estes métodos só decidem para os restantes
 * papéis — que não gerem categorias.
 */
class CategoryPolicy
{
    public function viewAny(User $user): bool
    {
        return false;
    }

    public function view(User $user, Category $category): bool
    {
        return false;
    }

    public function create(User $user): bool
    {
        return false;
    }

    public function update(User $user, Category $category): bool
    {
        return false;
    }

    public function delete(User $user, Category $category): bool
    {
        return false;
    }
}
