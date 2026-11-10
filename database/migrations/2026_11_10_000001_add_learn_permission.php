<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Permissão nova "aprender" (Fazer cursos), 2026-11-10: as caixas de aluno do Início passam a depender dela.
 * Perfis com permissões já guardadas (aluno e team leader) ganham-na, para nada mudar para eles.
 * Os perfis sem permissões guardadas (null) já a recebem pelos valores iniciais.
 */
return new class extends Migration
{
    private const ROLES = ['aluno', 'team_leader'];

    public function up(): void
    {
        $this->each(fn (array $p) => array_values(array_unique([...$p, 'aprender'])));
    }

    public function down(): void
    {
        $this->each(fn (array $p) => array_values(array_diff($p, ['aprender'])));
    }

    private function each(callable $change): void
    {
        DB::table('roles')->whereIn('name', self::ROLES)->whereNotNull('permissions')->get()->each(function ($role) use ($change) {
            $p = json_decode($role->permissions, true) ?: [];
            DB::table('roles')->where('id', $role->id)->update(['permissions' => json_encode($change($p))]);
        });
    }
};
