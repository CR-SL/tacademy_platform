<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Página da aula do aluno.
 * - lesson_progress: segundos do vídeo realmente vistos (mapa de bits, 1 bit por segundo — saltar à frente
 *   não conta e rever não conta duas vezes), duração real do vídeo e respostas às perguntas rápidas.
 * - quiz_attempts: respostas dadas em cada tentativa, para o aluno poder rever (sem alterar).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lesson_progress', function (Blueprint $table) {
            $table->text('watched_map')->nullable()->after('last_position_seconds'); // base64
            $table->unsignedInteger('watched_seconds')->default(0)->after('watched_map');
            $table->unsignedInteger('video_duration_seconds')->nullable()->after('watched_seconds');
            $table->json('check_answers')->nullable()->after('video_duration_seconds'); // {check_id: opção}
        });

        Schema::table('quiz_attempts', function (Blueprint $table) {
            $table->json('answers')->nullable()->after('passed'); // {question_id: option_id}
        });
    }

    public function down(): void
    {
        Schema::table('quiz_attempts', fn (Blueprint $table) => $table->dropColumn('answers'));
        Schema::table('lesson_progress', fn (Blueprint $table) => $table->dropColumn(['watched_map', 'watched_seconds', 'video_duration_seconds', 'check_answers']));
    }
};
