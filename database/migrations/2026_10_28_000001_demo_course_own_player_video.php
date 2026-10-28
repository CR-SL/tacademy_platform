<?php

use Database\Seeders\DemoCourseSeeder;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * O curso de demonstração passa a usar o leitor próprio (vídeo de teste em HLS) em vez do vídeo do YouTube.
 * O DemoCourseSeeder só corre uma vez, por isso o curso que já existe (local e produção) é atualizado aqui.
 */
return new class extends Migration
{
    private const SLUG = 'mecanica-automovel-formacao-completa';

    private const YOUTUBE = 'https://www.youtube.com/watch?v=baKzmOEP9D8';

    public function up(): void
    {
        $this->swap(self::YOUTUBE, DemoCourseSeeder::VIDEO);
    }

    public function down(): void
    {
        $this->swap(DemoCourseSeeder::VIDEO, self::YOUTUBE);
    }

    private function swap(string $from, string $to): void
    {
        $courseId = DB::table('courses')->where('slug', self::SLUG)->value('id');
        if (! $courseId) return;

        DB::table('lessons')
            ->whereIn('module_id', DB::table('modules')->where('course_id', $courseId)->select('id'))
            ->where('content_url', $from)
            ->update(['content_url' => $to]);
    }
};
