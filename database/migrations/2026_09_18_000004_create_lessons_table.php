<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lessons', function (Blueprint $table) {
            $table->id();
            $table->ulid('ulid')->unique();
            $table->foreignId('module_id')->constrained('modules')->cascadeOnDelete();
            $table->string('title', 200);
            $table->enum('content_type', ['video_upload', 'avatar', 'live', 'quiz', 'document', 'text'])->default('video_upload');
            $table->string('content_url')->nullable();
            $table->string('avatar_ref', 500)->nullable(); // integração Tavus (secção 12 do plano)
            $table->unsignedInteger('duration_seconds')->default(0);
            $table->unsignedInteger('order_index')->default(0);
            $table->boolean('is_downloadable')->default(false);
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lessons');
    }
};
