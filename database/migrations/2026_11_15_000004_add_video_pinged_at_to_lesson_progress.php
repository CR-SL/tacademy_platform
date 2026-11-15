<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Última vez que o servidor aceitou segundos vistos de um vídeo (2026-11-15). Serve para limitar os segundos novos
 * de cada envio ao tempo real que passou (LearningService::recordProgress): sem isto, bastava enviar um mapa
 * "tudo visto" para concluir a aula sem a ver.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lesson_progress', function (Blueprint $table) {
            $table->timestamp('video_pinged_at')->nullable()->after('video_duration_seconds');
        });
    }

    public function down(): void
    {
        Schema::table('lesson_progress', fn (Blueprint $table) => $table->dropColumn('video_pinged_at'));
    }
};
