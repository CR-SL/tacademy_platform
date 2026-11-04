<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Dashboard em painéis:
 * - users.panel_layouts: disposição das caixas de cada utilizador, por página;
 * - course_messages: conversa entre um aluno e o formador de um curso.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->json('panel_layouts')->nullable();
        });

        Schema::create('course_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('course_id')->constrained('courses')->cascadeOnDelete();
            $table->foreignId('student_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('sender_id')->constrained('users')->cascadeOnDelete();
            $table->text('body');
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
            $table->index(['course_id', 'student_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('course_messages');
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn('panel_layouts'));
    }
};
