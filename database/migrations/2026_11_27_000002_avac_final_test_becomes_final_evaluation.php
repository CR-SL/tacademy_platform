<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Curso AVAC (2026-11-27, pedido do utilizador): o questionário do módulo "Teste final" passa a ser a avaliação final
 * do curso (com perguntas). As tentativas dos alunos ficam, porque o questionário é o mesmo; a aula e o módulo
 * "Teste final", que ficam vazios, saem.
 */
return new class extends Migration
{
    public function up(): void
    {
        $course = DB::table('courses')->where('slug', 'recertificacao-avac-automovel')->first();
        if (! $course) return;

        $module = DB::table('modules')->where('course_id', $course->id)->where('title', 'Teste final')->whereNull('deleted_at')->first();
        if (! $module) return;
        $lessons = DB::table('lessons')->where('module_id', $module->id)->whereNull('deleted_at')->get();
        if ($lessons->count() !== 1) return;
        $lesson = $lessons->first();
        $quiz = DB::table('quizzes')->where('lesson_id', $lesson->id)->first();
        if (! $quiz) return;

        DB::transaction(function () use ($course, $module, $lesson, $quiz) {
            DB::table('quizzes')->where('id', $quiz->id)->update(['lesson_id' => null, 'course_id' => $course->id, 'title' => 'Avaliação final']);
            DB::table('courses')->where('id', $course->id)->update(['final_mode' => 'questions', 'final_pass' => $quiz->passing_score ?: 70]);
            DB::table('lesson_progress')->where('lesson_id', $lesson->id)->delete();
            DB::table('lessons')->where('id', $lesson->id)->update(['deleted_at' => now()]);
            DB::table('modules')->where('id', $module->id)->update(['deleted_at' => now()]);
        });
    }

    public function down(): void
    {
        // Sem volta automática: o questionário continua guardado na avaliação final do curso
    }
};
