<?php

namespace Database\Seeders;

use App\Models\Role;
use Illuminate\Database\Seeder;

class RoleSeeder extends Seeder
{
    public function run(): void
    {
        // Um papel por utilizador (role_id). Autorização via Gates/Policies nativos.
        foreach (['aluno', 'formador', 'admin', 'gestor'] as $name) {
            Role::firstOrCreate(['name' => $name]);
        }
    }
}
