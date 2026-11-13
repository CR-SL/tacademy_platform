<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Formador IA (Alex) por curso, 2026-11-13:
 * - courses.alex_enabled: o curso tem o Alex (Início, Avaliações e aulas);
 * - courses.alex_pal_id / alex_face_id: o Alex próprio do curso no Tavus (vazio = o Alex geral);
 * - permissão nova "cursos.alex": só quem a tem liga o Alex (custa minutos no Tavus). O gestor de cursos
 *   ganha-a; o admin tem sempre tudo.
 * O curso de AVAC ("diagnostico-automovel") e os que têm "avac" no endereço ficam com o Alex ligado,
 * como estavam até aqui pela variável TAVUS_ALEX_COURSES.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('courses', function (Blueprint $table) {
            $table->boolean('alex_enabled')->default(false)->after('requires_attendance');
            $table->string('alex_pal_id', 64)->nullable()->after('alex_enabled');
            $table->string('alex_face_id', 64)->nullable()->after('alex_pal_id');
        });

        DB::table('courses')->where('slug', 'diagnostico-automovel')->orWhere('slug', 'like', '%avac%')->update(['alex_enabled' => true]);

        $this->gestor(fn (array $p) => array_values(array_unique([...$p, 'cursos.alex'])));
    }

    public function down(): void
    {
        $this->gestor(fn (array $p) => array_values(array_diff($p, ['cursos.alex'])));
        Schema::table('courses', function (Blueprint $table) {
            $table->dropColumn(['alex_enabled', 'alex_pal_id', 'alex_face_id']);
        });
    }

    // Só os perfis com permissões guardadas; os outros recebem-na pelos valores iniciais (Permissions::DEFAULTS)
    private function gestor(callable $change): void
    {
        DB::table('roles')->where('name', 'gestor_cursos')->whereNotNull('permissions')->get()->each(function ($role) use ($change) {
            $p = json_decode($role->permissions, true) ?: [];
            DB::table('roles')->where('id', $role->id)->update(['permissions' => json_encode($change($p))]);
        });
    }
};
