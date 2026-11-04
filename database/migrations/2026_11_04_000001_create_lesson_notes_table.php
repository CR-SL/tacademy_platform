<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Notas do aluno em cada aula; nas aulas de vídeo guardam o segundo em que foram escritas
        Schema::create('lesson_notes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('lesson_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('position_seconds')->nullable();
            $table->text('body');
            $table->timestamps();
            $table->index(['user_id', 'lesson_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lesson_notes');
    }
};
