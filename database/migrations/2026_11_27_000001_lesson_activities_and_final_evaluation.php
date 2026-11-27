<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Fase 2 (2026-11-27): cada módulo é uma lista de atividades e o curso tem uma avaliação final à parte.
 *
 * - lessons.kind: aula | exercicio | teste | roleplay. Reaproveita as colunas que já existiam:
 *   evaluation = 'quiz' (perguntas) ou 'avatar' nos testes; 'quiz' (perguntas) ou 'none' (prático) nos exercícios;
 *   evaluation_prompt = casos do teste com avatar / instruções do roleplay; evaluation_pal_id e avatar_ref = o avatar
 *   (PAL ID ou link); body = o que o aluno lê (exercício prático, situação do roleplay).
 * - roleplay_role e graded: o papel do avatar e se o roleplay tem nota.
 * - quizzes: weighted (pesos por pergunta, opcional), graded (false nos exercícios) e course_id (avaliação final).
 * - quiz_questions.points: o peso de cada pergunta quando o teste tem pesos.
 * - courses: final_mode (questions | avatar | none), final_pass, final_minutes, final_prompt, final_pal_id e
 *   final_weight (% da avaliação final na nota final do curso; o resto é a média dos testes).
 *
 * Os cursos que existem passam para a estrutura nova: a avaliação que estava dentro de uma aula passa a ser um
 * Teste a seguir a essa aula (o questionário muda de aula com as tentativas dos alunos); o avatar deixa de ser
 * uma parte da aula (é o avatar de ajuda do curso).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lessons', function (Blueprint $table) {
            $table->string('kind', 12)->default('aula')->after('module_id');
            $table->string('roleplay_role', 255)->nullable()->after('evaluation_prompt');
            $table->boolean('graded')->default(true)->after('roleplay_role');
        });
        Schema::table('quizzes', function (Blueprint $table) {
            $table->foreignId('lesson_id')->nullable()->change();
            $table->foreignId('course_id')->nullable()->after('lesson_id')->constrained('courses')->cascadeOnDelete();
            $table->boolean('weighted')->default(false)->after('max_attempts');
            $table->boolean('graded')->default(true)->after('weighted');
        });
        Schema::table('quiz_questions', function (Blueprint $table) {
            $table->unsignedSmallInteger('points')->default(1)->after('question');
        });
        Schema::table('courses', function (Blueprint $table) {
            $table->string('final_mode', 12)->default('none');
            $table->unsignedTinyInteger('final_pass')->default(70);
            $table->unsignedSmallInteger('final_minutes')->default(15);
            $table->text('final_prompt')->nullable();
            $table->string('final_pal_id', 64)->nullable();
            $table->unsignedTinyInteger('final_weight')->default(50);
        });

        $this->convert();
    }

    private function convert(): void
    {
        // Avaliação final: nos cursos com o Alex era o botão Avaliação (o Alex avalia o curso)
        DB::table('courses')->where('alex_enabled', true)->update(['final_mode' => 'avatar']);

        $lessons = DB::table('lessons')->whereNull('deleted_at')->orderBy('module_id')->orderBy('order_index')->get();
        foreach ($lessons->groupBy('module_id') as $moduleLessons) {
            $order = 0;
            foreach ($moduleLessons as $l) {
                $parts = array_values(array_diff(json_decode($l->parts ?? '[]', true) ?: [], ['avatar']));
                $evaluation = $l->evaluation ?: ($l->content_type === 'quiz' ? 'quiz' : 'none');

                // Só o teste (sem vídeo, material nem notas): a própria aula passa a ser o Teste
                if ($evaluation !== 'none' && $parts === []) {
                    DB::table('lessons')->where('id', $l->id)->update(['kind' => 'teste', 'parts' => '[]', 'order_index' => $order++]);
                    continue;
                }

                DB::table('lessons')->where('id', $l->id)->update([
                    'kind' => 'aula', 'parts' => json_encode($parts), 'evaluation' => 'none',
                    'evaluation_prompt' => null, 'evaluation_pal_id' => null, 'order_index' => $order++,
                    'content_type' => $parts === [] ? $l->content_type : (in_array('video', $parts) ? ($l->content_type === 'video_upload' ? 'video_upload' : 'video_link') : (in_array('material', $parts) ? 'document' : 'text')),
                ]);
                if ($evaluation === 'none') continue;

                // A avaliação da aula passa a ser um Teste logo a seguir
                $testId = DB::table('lessons')->insertGetId([
                    'ulid' => (string) Str::ulid(),
                    'module_id' => $l->module_id,
                    'kind' => 'teste',
                    'title' => $evaluation === 'quiz' ? 'Teste' : 'Teste com o avatar',
                    'content_type' => $evaluation === 'quiz' ? 'quiz' : 'avatar',
                    'parts' => '[]',
                    'evaluation' => $evaluation,
                    'evaluation_prompt' => $l->evaluation_prompt,
                    'evaluation_pal_id' => $l->evaluation_pal_id,
                    'duration_seconds' => 0,
                    'order_index' => $order++,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                if ($evaluation === 'quiz') {
                    DB::table('quizzes')->where('lesson_id', $l->id)->update(['lesson_id' => $testId]);
                }
            }
        }
    }

    public function down(): void
    {
        Schema::table('courses', function (Blueprint $table) {
            $table->dropColumn(['final_mode', 'final_pass', 'final_minutes', 'final_prompt', 'final_pal_id', 'final_weight']);
        });
        Schema::table('quiz_questions', function (Blueprint $table) {
            $table->dropColumn('points');
        });
        Schema::table('quizzes', function (Blueprint $table) {
            $table->dropConstrainedForeignId('course_id');
            $table->dropColumn(['weighted', 'graded']);
        });
        Schema::table('lessons', function (Blueprint $table) {
            $table->dropColumn(['kind', 'roleplay_role', 'graded']);
        });
    }
};
