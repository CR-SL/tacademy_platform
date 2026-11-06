<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Prazos, lembretes e presença:
 * - courses.deadline_days: prazo opcional de quem cria o curso (dias a contar da inscrição);
 * - courses.requires_attendance: o formador decide se o certificado exige presença;
 * - enrollments.due_at: prazo definido pela empresa ao atribuir a formação (sobrepõe o do curso);
 * - enrollments.assigned_at/assigned_by, reminded_at: atribuições e lembretes do team leader;
 * - enrollments.attended_at: presença confirmada pelo formador.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('courses', function (Blueprint $table) {
            $table->unsignedSmallInteger('deadline_days')->nullable()->after('access_months');
            $table->boolean('requires_attendance')->default(false)->after('certificate_min_score');
        });

        Schema::table('enrollments', function (Blueprint $table) {
            $table->date('due_at')->nullable()->after('completed_at');
            $table->timestamp('assigned_at')->nullable()->after('due_at');
            $table->foreignId('assigned_by')->nullable()->after('assigned_at')->constrained('users')->nullOnDelete();
            $table->timestamp('reminded_at')->nullable()->after('assigned_by');
            $table->timestamp('attended_at')->nullable()->after('reminded_at');
        });
    }

    public function down(): void
    {
        Schema::table('enrollments', function (Blueprint $table) {
            $table->dropConstrainedForeignId('assigned_by');
            $table->dropColumn(['due_at', 'assigned_at', 'reminded_at', 'attended_at']);
        });
        Schema::table('courses', function (Blueprint $table) {
            $table->dropColumn(['deadline_days', 'requires_attendance']);
        });
    }
};
