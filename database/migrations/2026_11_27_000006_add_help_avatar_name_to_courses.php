<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * O nome do avatar de ajuda de cada curso (o Alex é só um exemplo): aparece ao aluno no botão, na janela da conversa
 * e na saudação. Os cursos que já têm o avatar ligado ficam com "Alex", o nome que viam até agora.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('courses', function (Blueprint $t) {
            $t->string('alex_name', 40)->nullable()->after('alex_enabled');
        });
        DB::table('courses')->where('alex_enabled', true)->update(['alex_name' => 'Alex']);
    }

    public function down(): void
    {
        Schema::table('courses', function (Blueprint $t) {
            $t->dropColumn('alex_name');
        });
    }
};