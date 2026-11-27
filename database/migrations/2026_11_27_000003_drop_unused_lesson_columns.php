<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Limpeza (2026-11-27): colunas que deixaram de ser usadas.
 * - courses.sample_lesson_id: a aula de amostra grátis saiu (só os inscritos abrem as aulas, 2026-11-26);
 * - lessons.alex_pal_id: o avatar de ajuda é do curso (e do módulo), já não de cada aula;
 * - lessons.is_downloadable e quizzes.trigger_at_seconds: do plano inicial, nunca usadas.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('courses', 'sample_lesson_id')) {
            Schema::table('courses', fn (Blueprint $t) => $t->dropConstrainedForeignId('sample_lesson_id'));
        }
        foreach (['alex_pal_id', 'is_downloadable'] as $col) {
            if (Schema::hasColumn('lessons', $col)) {
                Schema::table('lessons', fn (Blueprint $t) => $t->dropColumn($col));
            }
        }
        if (Schema::hasColumn('quizzes', 'trigger_at_seconds')) {
            Schema::table('quizzes', fn (Blueprint $t) => $t->dropColumn('trigger_at_seconds'));
        }
    }

    public function down(): void
    {
        Schema::table('courses', fn (Blueprint $t) => $t->foreignId('sample_lesson_id')->nullable()->after('certificate_min_score')->constrained('lessons')->nullOnDelete());
        Schema::table('lessons', function (Blueprint $t) {
            $t->string('alex_pal_id', 64)->nullable()->after('avatar_ref');
            $t->boolean('is_downloadable')->default(false);
        });
        Schema::table('quizzes', fn (Blueprint $t) => $t->unsignedInteger('trigger_at_seconds')->nullable()->after('passing_score'));
    }
};
