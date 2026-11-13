<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Créditos de avatar (Alex), 2026-11-13: 1 crédito = 1 conversa (até 15 minutos).
 * - users.alex_credits: créditos por gastar;
 * - alex_conversations.paid_credit: a conversa gastou um crédito (devolve-se se o Tavus falhar);
 * - contact_requests.credits: pacote pedido numa compra de créditos (pedido "creditos", autorizado pelo gestor).
 * Quem tem um curso com o avatar tem 3 conversas grátis por dia; os créditos servem para além delas.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->unsignedInteger('alex_credits')->default(0);
        });
        Schema::table('alex_conversations', function (Blueprint $table) {
            $table->boolean('paid_credit')->default(false)->after('place');
        });
        Schema::table('contact_requests', function (Blueprint $table) {
            $table->unsignedSmallInteger('credits')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('contact_requests', fn (Blueprint $table) => $table->dropColumn('credits'));
        Schema::table('alex_conversations', fn (Blueprint $table) => $table->dropColumn('paid_credit'));
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn('alex_credits'));
    }
};
