<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Registo de atividade (2026-11-15): uma linha por ação que importa (contas, compras e acessos,
 * cursos, equipas, administração e marcos da aprendizagem), com o IP de quem a fez.
 * Só o admin consulta. Só se acrescentam linhas: a plataforma não as edita.
 * Ao fim de 12 meses as linhas apagam-se; as de compras e certificados ficam, sem IP (App\Support\Activity::prune).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('activity_log', function (Blueprint $table) {
            $table->id();
            $table->timestamp('created_at')->useCurrent()->index();
            // Quem fez a ação (null = a plataforma ou alguém sem sessão, como uma entrada falhada)
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('user_name', 150)->nullable(); // o nome nesse momento
            $table->string('role', 30)->nullable();       // o perfil nesse momento
            $table->string('action', 60)->index();        // ex.: curso.publicado, conta.entrada_falhou
            // Sobre o quê (curso, pedido, equipa…) e sobre quem (o aluno a quem se deu acesso, por exemplo)
            $table->string('subject_type', 40)->nullable();
            $table->unsignedBigInteger('subject_id')->nullable();
            $table->string('subject_label', 200)->nullable();
            $table->foreignId('related_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->json('properties')->nullable();       // o que mudou (antes → depois) e outros pormenores
            $table->string('ip', 45)->nullable();
            $table->string('user_agent', 255)->nullable();

            $table->index(['user_id', 'created_at']);
            $table->index(['related_user_id', 'created_at']);
            $table->index(['subject_type', 'subject_id']);
            $table->index('ip');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_log');
    }
};
