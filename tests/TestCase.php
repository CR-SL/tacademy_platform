<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Storage;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        // Nenhum teste toca nos ficheiros reais (storage/app): os discos são sempre falsos. Em 2026-11-16 um teste
        // com o disco real apagou os vídeos carregados localmente. Um teste que precise do disco real tem de o pedir.
        Storage::fake('public');
        Storage::fake('local');
        // Os pedidos de teste simulam um browser em inglês; a plataforma é testada em português
        $this->withHeader('Accept-Language', 'pt-PT,pt;q=0.9');
    }
}
