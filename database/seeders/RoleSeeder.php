<?php

namespace Database\Seeders;

use App\Models\Role;
use Illuminate\Database\Seeder;

class RoleSeeder extends Seeder
{
    public function run(): void
    {
        // Um papel por utilizador (role_id). Autorização via Gates/Policies nativos.
        // team_leader = responsável da equipa da empresa; gestor_cursos = equipa interna que gere pedidos e equipas
        foreach (['aluno', 'formador', 'admin', 'team_leader', 'gestor_cursos'] as $name) {
            Role::firstOrCreate(['name' => $name]);
        }
    }
}
