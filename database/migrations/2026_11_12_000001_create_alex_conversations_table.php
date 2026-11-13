<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Conversas com o Alex (avatar do Tavus, pela API): quem falou, onde, quanto tempo e a transcrição.
 * Serve para o limite diário por aluno, para ver o gasto e, mais tarde, para as avaliações.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('alex_conversations', function (Blueprint $table) {
            $table->id();
            $table->ulid('ulid')->unique();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('course_id')->nullable()->constrained('courses')->nullOnDelete();
            $table->foreignId('lesson_id')->nullable()->constrained('lessons')->nullOnDelete();
            $table->string('place', 20); // inicio | avaliacoes | aula
            $table->string('tavus_id', 64)->nullable()->unique();
            $table->string('status', 20)->default('starting'); // starting | active | ended | failed
            $table->string('end_reason', 120)->nullable();
            $table->timestamp('ended_at')->nullable();
            $table->json('transcript')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('alex_conversations');
    }
};
