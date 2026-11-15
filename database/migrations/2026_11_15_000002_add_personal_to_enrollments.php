<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Inscrições pessoais (2026-11-15): `personal` = o aluno tem o curso por conta própria (compra ou acesso individual),
 * além de o ter, ou não, pela equipa. Quem sai da equipa, ou perde o curso da equipa, mantém as inscrições pessoais
 * (só deixam de contar para a empresa), tal como os cursos já concluídos ou com certificado
 * (ver Enrollment::releaseFromCompany). A conta da pessoa nunca é apagada.
 * As inscrições que já existem sem empresa são pessoais. Nas que têm empresa não se sabe: ficam como da equipa.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('enrollments', function (Blueprint $table) {
            $table->boolean('personal')->default(false)->after('company_id');
        });
        DB::table('enrollments')->whereNull('company_id')->update(['personal' => true]);
    }

    public function down(): void
    {
        Schema::table('enrollments', function (Blueprint $table) {
            $table->dropColumn('personal');
        });
    }
};
