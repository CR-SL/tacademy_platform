<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Definições → Notificações: o aluno pode desligar os lembretes por email que o team leader envia.
// Os emails essenciais (acesso dado, curso atribuído, palavra-passe) não se desligam.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('email_reminders')->default(true)->after('theme');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('email_reminders');
        });
    }
};
