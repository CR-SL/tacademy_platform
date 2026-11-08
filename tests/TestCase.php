<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        // Os pedidos de teste simulam um browser em inglês; a plataforma é testada em português
        $this->withHeader('Accept-Language', 'pt-PT,pt;q=0.9');
    }
}
