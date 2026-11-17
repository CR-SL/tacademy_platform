<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Referência do pagamento (MB Way, transferência, fatura…) que o gestor de cursos escreve ao autorizar uma compra
 * pessoal ou de créditos. Sem ela, uma compra paga não se autoriza.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('contact_requests', function (Blueprint $table) {
            $table->string('payment_ref', 120)->nullable()->after('amount');
        });
    }

    public function down(): void
    {
        Schema::table('contact_requests', function (Blueprint $table) {
            $table->dropColumn('payment_ref');
        });
    }
};
