<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * O Alex por módulo (2026-11-16): cada módulo pode ter o seu PAL (e rosto) no Tavus, com as perguntas da
 * avaliação desse módulo. Nas aulas do módulo, as dúvidas e a avaliação usam esse PAL; vazio = o PAL do curso
 * (ou o Alex geral).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('modules', function (Blueprint $table) {
            $table->string('alex_pal_id', 64)->nullable()->after('description');
            $table->string('alex_face_id', 64)->nullable()->after('alex_pal_id');
        });
    }

    public function down(): void
    {
        Schema::table('modules', function (Blueprint $table) {
            $table->dropColumn(['alex_pal_id', 'alex_face_id']);
        });
    }
};
