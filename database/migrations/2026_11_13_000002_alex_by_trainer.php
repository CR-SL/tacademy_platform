<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Avatar (Alex) escolhido pelo formador, 2026-11-13:
 * - o formador passa a ligar o Alex nos seus cursos (permissão "cursos.alex"), no passo "Avatar" do editor;
 * - o admin e o gestor de cursos podem desligá-lo e bloqueá-lo em qualquer curso (permissão nova
 *   "cursos.alex.gerir", na Administração › Formador IA); com courses.alex_blocked o formador já não o liga.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('courses', function (Blueprint $table) {
            $table->boolean('alex_blocked')->default(false)->after('alex_face_id');
        });

        $this->role('formador', fn (array $p) => [...$p, 'cursos.alex']);
        $this->role('gestor_cursos', fn (array $p) => [...$p, 'cursos.alex.gerir']);
    }

    public function down(): void
    {
        $this->role('formador', fn (array $p) => array_diff($p, ['cursos.alex']));
        $this->role('gestor_cursos', fn (array $p) => array_diff($p, ['cursos.alex.gerir']));
        Schema::table('courses', function (Blueprint $table) {
            $table->dropColumn('alex_blocked');
        });
    }

    // Só os perfis com permissões guardadas; os outros recebem-nas pelos valores iniciais (Permissions::DEFAULTS)
    private function role(string $name, callable $change): void
    {
        DB::table('roles')->where('name', $name)->whereNotNull('permissions')->get()->each(function ($role) use ($change) {
            $p = json_decode($role->permissions, true) ?: [];
            DB::table('roles')->where('id', $role->id)->update(['permissions' => json_encode(array_values(array_unique($change($p))))]);
        });
    }
};
