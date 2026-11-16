<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Registo de atividade: apaga o que passou dos 12 meses (compras e certificados ficam, sem IP).
// Também corre sozinho no primeiro registo de cada dia, porque no Railway não há agendador.
Artisan::command('activity:prune', function () {
    $this->info('Linhas apagadas: '.\App\Support\Activity::prune());
})->purpose('Limpa o registo de atividade com mais de 12 meses');

\Illuminate\Support\Facades\Schedule::command('activity:prune')->daily();

// Ficheiros carregados no editor e nunca gravados num curso, e pedaços de envios interrompidos (com mais de 24 h).
// Só à mão: sem --force mostra a lista; com --force apaga. Não corre sozinho (apaga ficheiros do disco).
Artisan::command('files:clean {--force : Apagar mesmo (sem isto, só mostra a lista)}', function () {
    $found = \App\Support\OrphanFiles::clean((bool) $this->option('force'));
    foreach ($found as $kind => $paths) {
        foreach ($paths as $path) $this->line("  $kind: $path");
    }
    $n = array_sum(array_map('count', $found));
    $this->info($this->option('force') ? "Apagados: $n ficheiros." : "$n ficheiros sem uso. Nada foi apagado: corre com --force para apagar.");
})->purpose('Mostra (ou apaga, com --force) os ficheiros carregados que ficaram sem uso');
