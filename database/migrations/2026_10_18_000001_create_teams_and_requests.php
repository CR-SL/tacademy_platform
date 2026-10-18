<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Equipas de empresas e pedidos.
 * - Perfis: `gestor` passa a `team_leader` (responsável da equipa da empresa) e nasce `gestor_cursos` (T.Academy).
 * - Uma empresa = uma equipa: lugares em packs de 10 e cursos da equipa (`company_course`).
 * - As inscrições feitas pela equipa ficam marcadas com `company_id` (o team leader só vê essas).
 * - `contact_requests` passa a ser a lista de "Pedidos" (esclarecimento, compra, alteração de equipa),
 *   com estados, responsável e conversa (`request_messages`).
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('roles')->where('name', 'gestor')->update(['name' => 'team_leader']);
        foreach (['team_leader', 'gestor_cursos'] as $role) {
            if (! DB::table('roles')->where('name', $role)->exists()) {
                DB::table('roles')->insert(['name' => $role, 'created_at' => now()]);
            }
        }

        Schema::table('companies', function (Blueprint $table) {
            $table->unsignedSmallInteger('packs')->default(1)->after('city'); // lugares = packs × 10
        });

        Schema::create('company_course', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('course_id')->constrained('courses')->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['company_id', 'course_id']);
        });

        Schema::table('enrollments', function (Blueprint $table) {
            $table->foreignId('company_id')->nullable()->after('course_id')->constrained('companies')->nullOnDelete();
        });

        Schema::table('contact_requests', function (Blueprint $table) {
            $table->string('kind', 20)->default('esclarecimento')->after('id'); // esclarecimento | compra | alteracao
            $table->string('status', 30)->default('novo')->change();
            $table->string('nif', 20)->nullable()->after('company');
            $table->unsignedTinyInteger('packs')->nullable()->after('course_id');
            $table->json('people')->nullable()->after('packs'); // [{name, email}]
            $table->string('change_type', 40)->nullable()->after('people');
            $table->foreignId('company_id')->nullable()->after('change_type')->constrained('companies')->nullOnDelete();
            $table->foreignId('user_id')->nullable()->after('company_id')->constrained('users')->nullOnDelete();
            $table->foreignId('assigned_to')->nullable()->after('user_id')->constrained('users')->nullOnDelete();
            $table->timestamp('consent_at')->nullable()->change(); // pedidos feitos dentro da plataforma
        });
        DB::table('contact_requests')->where('status', 'em_contacto')->update(['status' => 'em_esclarecimento']);
        DB::table('contact_requests')->where('status', 'fechado')->update(['status' => 'concluido']);

        Schema::create('request_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('contact_request_id')->constrained('contact_requests')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('author', 150);
            $table->text('body');
            $table->boolean('from_staff')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('request_messages');

        DB::table('contact_requests')->whereIn('status', ['em_esclarecimento', 'aguardar_pagamento', 'pago', 'equipa_criada'])->update(['status' => 'em_contacto']);
        DB::table('contact_requests')->whereIn('status', ['concluido', 'cancelado'])->update(['status' => 'fechado']);
        Schema::table('contact_requests', function (Blueprint $table) {
            $table->dropConstrainedForeignId('assigned_to');
            $table->dropConstrainedForeignId('user_id');
            $table->dropConstrainedForeignId('company_id');
            $table->dropColumn(['kind', 'nif', 'packs', 'people', 'change_type']);
        });

        Schema::table('enrollments', function (Blueprint $table) {
            $table->dropConstrainedForeignId('company_id');
        });
        Schema::dropIfExists('company_course');
        Schema::table('companies', function (Blueprint $table) {
            $table->dropColumn('packs');
        });

        DB::table('roles')->where('name', 'gestor_cursos')->delete();
        DB::table('roles')->where('name', 'team_leader')->update(['name' => 'gestor']);
    }
};
