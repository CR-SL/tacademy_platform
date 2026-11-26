<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Limpeza (2026-11-25): tabelas do plano inicial que a plataforma nunca chegou a usar.
 * - payments e coupons: o pagamento é feito fora da plataforma (pedidos que o gestor autoriza);
 * - badges e user_badges, reviews, live_sessions: funcionalidades que não avançaram;
 * - notifications: os avisos são por email, nunca guardados na base de dados.
 *
 * Por segurança, uma tabela só sai se estiver vazia (assim nada se perde em produção se alguma tiver dados).
 */
return new class extends Migration
{
    /** Pela ordem certa: primeiro as que apontam para as outras. */
    private const TABLES = ['user_badges', 'badges', 'reviews', 'live_sessions', 'notifications', 'payments', 'coupons'];

    public function up(): void
    {
        $empty = fn (string $t) => Schema::hasTable($t) && ! DB::table($t)->exists();

        // A inscrição tinha uma ligação ao pagamento que nunca foi preenchida
        if ($empty('payments') && Schema::hasColumn('enrollments', 'payment_id')
            && ! DB::table('enrollments')->whereNotNull('payment_id')->exists()) {
            Schema::table('enrollments', function (Blueprint $table) {
                $table->dropConstrainedForeignId('payment_id');
            });
        }

        foreach (self::TABLES as $t) {
            // payments só sai se a inscrição já não apontar para ela
            if ($t === 'payments' && Schema::hasColumn('enrollments', 'payment_id')) continue;
            if ($t === 'coupons' && Schema::hasTable('payments')) continue;
            if ($t === 'badges' && Schema::hasTable('user_badges')) continue;
            if ($empty($t)) Schema::drop($t);
        }
    }

    /** Volta a criar as tabelas vazias com as migrações originais (2026-09-18). */
    public function down(): void
    {
        $original = fn (string $file) => (require __DIR__.'/'.$file)->up();
        if (! Schema::hasTable('payments') && ! Schema::hasTable('coupons')) $original('2026_09_18_000005_create_payments_table.php');
        if (! Schema::hasColumn('enrollments', 'payment_id')) {
            Schema::table('enrollments', function (Blueprint $table) {
                $table->foreignId('payment_id')->nullable()->after('course_id')->constrained('payments')->nullOnDelete();
            });
        }
        if (! Schema::hasTable('badges') && ! Schema::hasTable('user_badges')) $original('2026_09_18_000009_create_badges_table.php');
        if (! Schema::hasTable('reviews')) $original('2026_09_18_000010_create_reviews_table.php');
        if (! Schema::hasTable('live_sessions')) $original('2026_09_18_000011_create_live_sessions_table.php');
        if (! Schema::hasTable('notifications')) $original('2026_09_18_000012_create_notifications_table.php');
    }
};
