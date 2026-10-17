<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Criação de cursos pelos formadores ("Os meus cursos"): campos de apresentação,
 * acesso e certificado no curso, vídeo por link e texto nas aulas, e anexos.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('courses', function (Blueprint $table) {
            // Um rascunho pode ainda não ter área
            $table->foreignId('category_id')->nullable()->change();
            $table->string('short_description', 200)->nullable()->after('description');
            $table->json('learning_outcomes')->nullable()->after('short_description');
            $table->string('prerequisites', 255)->nullable()->after('learning_outcomes');
            $table->string('audience', 255)->nullable()->after('prerequisites');
            $table->boolean('is_free')->default(false)->after('price');
            $table->unsignedSmallInteger('access_months')->nullable()->after('is_free'); // null = vitalício
            $table->boolean('sequential')->default(true)->after('access_months');
            $table->boolean('certificate_enabled')->default(true)->after('sequential');
            $table->unsignedTinyInteger('certificate_min_progress')->default(100)->after('certificate_enabled');
            $table->unsignedTinyInteger('certificate_min_score')->default(70)->after('certificate_min_progress');
            $table->foreignId('sample_lesson_id')->nullable()->after('certificate_min_score')->constrained('lessons')->nullOnDelete();
        });

        Schema::table('lessons', function (Blueprint $table) {
            $table->enum('content_type', ['video_upload', 'video_link', 'avatar', 'live', 'quiz', 'document', 'text'])->default('video_link')->change();
            $table->longText('body')->nullable()->after('avatar_ref'); // aulas de texto
        });

        Schema::create('lesson_attachments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lesson_id')->constrained('lessons')->cascadeOnDelete();
            $table->string('name', 200);
            $table->string('path', 300);
            $table->unsignedInteger('size')->default(0); // bytes
            $table->unsignedInteger('order_index')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lesson_attachments');

        Schema::table('lessons', function (Blueprint $table) {
            $table->dropColumn('body');
            $table->enum('content_type', ['video_upload', 'avatar', 'live', 'quiz', 'document', 'text'])->default('video_upload')->change();
        });

        Schema::table('courses', function (Blueprint $table) {
            $table->dropConstrainedForeignId('sample_lesson_id');
            $table->dropColumn([
                'short_description', 'learning_outcomes', 'prerequisites', 'audience', 'is_free',
                'access_months', 'sequential', 'certificate_enabled', 'certificate_min_progress', 'certificate_min_score',
            ]);
        });
    }
};
