<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Aulas com várias partes (2026-11-25): em vez de um tipo só, o formador liga em cada aula o vídeo, o material
 * didático, as notas e o avatar, e escolhe a avaliação (nenhuma, questionário ou com o avatar).
 * O content_type continua a ser gravado (o tipo principal da aula) para o catálogo e as aulas antigas.
 *
 * As aulas que já existem passam para o formato novo pelo tipo que tinham. Nos cursos com o Alex, todas as aulas
 * ficam com o avatar (como já era: o Alex aparecia em todas) e a última aula de cada módulo com PAL próprio fica
 * com a avaliação com o avatar desse módulo (era o botão Avaliação dessas aulas).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lessons', function (Blueprint $table) {
            $table->json('parts')->nullable()->after('content_type');
            $table->string('evaluation', 12)->nullable()->after('parts'); // none | quiz | avatar
            $table->text('evaluation_prompt')->nullable()->after('evaluation');
            $table->string('alex_pal_id', 64)->nullable()->after('avatar_ref');
            $table->string('evaluation_pal_id', 64)->nullable()->after('alex_pal_id');
        });

        $alexCourses = DB::table('courses')->where('alex_enabled', true)->pluck('id')->all();
        $modules = DB::table('modules')->get(['id', 'course_id', 'alex_pal_id'])->keyBy('id');
        $withFiles = DB::table('lesson_attachments')->distinct()->pluck('lesson_id')->flip();
        $lastOfModule = DB::table('lessons')->whereNull('deleted_at')
            ->selectRaw('module_id, MAX(order_index) as last')->groupBy('module_id')->pluck('last', 'module_id');

        DB::table('lessons')->orderBy('id')->each(function ($l) use ($alexCourses, $modules, $withFiles, $lastOfModule) {
            $module = $modules[$l->module_id] ?? null;
            $alex = $module && in_array($module->course_id, $alexCourses);
            $parts = match ($l->content_type) {
                'video_link', 'video_upload' => ['video'],
                'document' => ['material'],
                'text' => ['notas'],
                'avatar' => ['avatar'],
                default => [],
            };
            if (isset($withFiles[$l->id]) && ! in_array('material', $parts)) $parts[] = 'material';
            if ($alex && ! in_array('avatar', $parts)) $parts[] = 'avatar';

            $evaluation = $l->content_type === 'quiz' ? 'quiz' : 'none';
            if ($evaluation === 'none' && $alex && $module->alex_pal_id && (int) ($lastOfModule[$l->module_id] ?? -1) === (int) $l->order_index) {
                $evaluation = 'avatar';
            }

            DB::table('lessons')->where('id', $l->id)->update(['parts' => json_encode($parts), 'evaluation' => $evaluation]);
        });
    }

    public function down(): void
    {
        Schema::table('lessons', function (Blueprint $table) {
            $table->dropColumn(['parts', 'evaluation', 'evaluation_prompt', 'alex_pal_id', 'evaluation_pal_id']);
        });
    }
};
