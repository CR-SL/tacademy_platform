<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Conta apagada pela própria pessoa (RGPD): sem dados pessoais e sem volta. Diferente de "desativada" (deleted_at).
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('erased_at')->nullable()->after('deleted_at');
        });
    }

    public function down(): void
    {
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn('erased_at'));
    }
};
