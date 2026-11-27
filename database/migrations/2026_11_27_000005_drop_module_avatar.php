<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * O avatar de ajuda é um por curso (courses.alex_pal_id), só para tirar dúvidas. Os testes e roleplays de cada
 * módulo têm a sua persona (lessons.evaluation_pal_id, copiada dos módulos na 000004). Saem os PAL dos módulos.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('modules', function (Blueprint $t) {
            $t->dropColumn(['alex_pal_id', 'alex_face_id']);
        });
    }

    public function down(): void
    {
        Schema::table('modules', function (Blueprint $t) {
            $t->string('alex_pal_id', 64)->nullable()->after('description');
            $t->string('alex_face_id', 64)->nullable()->after('alex_pal_id');
        });
    }
};