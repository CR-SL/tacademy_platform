<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * - "Aulas desbloqueadas de cada vez" (1 / 3 / 5 / todas = 0) substitui o "Aulas por ordem" (sequential).
 *   Até aqui o sequential vinha sempre ligado por defeito, por isso os cursos existentes passam ao novo
 *   padrão (5); quem o tinha desligado passa a "todas".
 * - Perguntas rápidas no fim das aulas de vídeo (mini-quiz obrigatório responder, sem exigir acertar).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('courses', function (Blueprint $table) {
            $table->unsignedTinyInteger('unlock_window')->default(5)->after('access_months'); // 0 = todas
        });
        DB::table('courses')->where('sequential', false)->update(['unlock_window' => 0]);
        Schema::table('courses', function (Blueprint $table) {
            $table->dropColumn('sequential');
        });

        Schema::create('lesson_checks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lesson_id')->constrained('lessons')->cascadeOnDelete();
            $table->string('question', 500);
            $table->json('options'); // ["…", "…", …]
            $table->unsignedTinyInteger('correct')->default(0);
            $table->string('explanation', 500)->nullable(); // mostrada depois de responder
            $table->unsignedTinyInteger('order_index')->default(0);
            $table->boolean('ai_generated')->default(false); // para quando a IA as gerar
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lesson_checks');
        Schema::table('courses', function (Blueprint $table) {
            $table->boolean('sequential')->default(true)->after('access_months');
        });
        DB::table('courses')->where('unlock_window', 0)->update(['sequential' => false]);
        Schema::table('courses', function (Blueprint $table) {
            $table->dropColumn('unlock_window');
        });
    }
};
