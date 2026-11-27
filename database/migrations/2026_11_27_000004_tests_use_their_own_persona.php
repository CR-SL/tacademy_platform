<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Database\Migrations\Migration;

/**
 * Opção 1 (2026-11-27): o teste com avatar e o roleplay usam sempre uma persona do Tavus (PAL ID), com o guião lá.
 * Os testes que vieram da avaliação de um módulo com PAL próprio (o AVAC) ficam com esse PAL na própria atividade.
 */
return new class extends Migration
{
    public function up(): void
    {
        $tests = DB::table('lessons')->join('modules', 'modules.id', '=', 'lessons.module_id')
            ->where('lessons.kind', 'teste')->where('lessons.evaluation', 'avatar')
            ->whereNull('lessons.evaluation_pal_id')->whereNotNull('modules.alex_pal_id')
            ->get(['lessons.id', 'modules.alex_pal_id']);
        foreach ($tests as $t) {
            DB::table('lessons')->where('id', $t->id)->update(['evaluation_pal_id' => $t->alex_pal_id]);
        }
    }

    public function down(): void
    {
        // Sem volta: o PAL fica na atividade (é o mesmo do módulo)
    }
};
