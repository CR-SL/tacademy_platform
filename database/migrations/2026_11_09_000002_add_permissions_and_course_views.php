<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Administração:
 * - roles.permissions: o que cada perfil pode fazer (null = as permissões iniciais de App\Support\Permissions);
 * - course_views: cada vez que alguém abre um curso no catálogo (para as estatísticas de cliques).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            $table->json('permissions')->nullable()->after('name');
        });

        Schema::create('course_views', function (Blueprint $table) {
            $table->id();
            $table->foreignId('course_id')->constrained('courses')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['course_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('course_views');
        Schema::table('roles', fn (Blueprint $table) => $table->dropColumn('permissions'));
    }
};
