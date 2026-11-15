<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Confirmação do email obrigatória (2026-11-15, User implements MustVerifyEmail).
 * As contas que já existem dão-se como confirmadas, para ninguém ficar bloqueado de um dia para o outro
 * (até aqui a plataforma nunca pediu a confirmação). A partir de agora, só as contas novas a têm de fazer.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('users')->whereNull('email_verified_at')->update(['email_verified_at' => now()]);
    }

    public function down(): void
    {
        // Não se sabe que contas estavam por confirmar: fica como está
    }
};
