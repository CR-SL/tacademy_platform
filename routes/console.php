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
