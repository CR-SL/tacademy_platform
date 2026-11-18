<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Links dos convites (3 dias), à parte dos de "esqueci-me" (60 minutos). Ver config/auth.php (broker "invites").
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('invite_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('invite_tokens');
    }
};
