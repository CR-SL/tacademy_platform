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
    $this->info('Transcrições do Alex apagadas: '.\App\Support\Activity::pruneTranscripts());
})->purpose('Limpa o registo de atividade com mais de 12 meses e as transcrições do Alex com mais de 90 dias');

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

// Vídeos e anexos carregados antes da proteção (ainda na pasta pública, abrem para quem tiver o link).
// Sem --force mostra a lista; com --force passa-os para a pasta privada (copia, confirma o tamanho, e só então
// tira o original). Os endereços não mudam. Só à mão, uma vez, depois de publicar esta versão.
Artisan::command('files:make-private {--force : Passar mesmo (sem isto, só mostra a lista)}', function () {
    try {
        $result = \App\Support\CourseFiles::makePrivate((bool) $this->option('force'));
    } catch (\RuntimeException $e) {
        $this->error($e->getMessage());

        return 1;
    }
    foreach ($result['moved'] as $path) $this->line('  '.$path);
    foreach ($result['failed'] as $path) $this->error('  falhou (ficou na pasta pública): '.$path);
    $n = count($result['moved']);
    $this->info($this->option('force')
        ? "Passados para a pasta privada: $n ficheiros.".($result['failed'] ? ' Falharam: '.count($result['failed']).'.' : '')
        : "$n ficheiros ainda na pasta pública. Nada foi mexido: corre com --force para os passar.");
})->purpose('Passa os vídeos e anexos das aulas para a pasta privada (com --force)');
