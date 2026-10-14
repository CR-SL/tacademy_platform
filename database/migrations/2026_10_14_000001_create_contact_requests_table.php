<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Pedidos de contacto enviados pela página pública /contactos.
     * Geridos no backoffice (Filament) pelo estado.
     */
    public function up(): void
    {
        Schema::create('contact_requests', function (Blueprint $table) {
            $table->id();
            $table->enum('type', ['empresa', 'particular']);
            $table->string('name', 150);
            $table->string('email', 150);
            $table->string('phone', 30)->nullable();
            $table->string('company', 150)->nullable();
            $table->string('team_size', 20)->nullable(); // 1-5, 6-20, 21-50, 50+
            $table->foreignId('course_id')->nullable()->constrained('courses')->nullOnDelete();
            $table->text('message');
            $table->timestamp('consent_at'); // consentimento RGPD
            $table->enum('status', ['novo', 'em_contacto', 'fechado'])->default('novo');
            $table->timestamps();

            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contact_requests');
    }
};
