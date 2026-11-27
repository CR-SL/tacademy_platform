<?php

namespace App\Services;

use RuntimeException;

/** Acabaram os minutos de avatar incluídos no curso e o aluno não tem créditos. */
class AlexLimitReached extends RuntimeException
{
    public function __construct()
    {
        parent::__construct('Acabaram os minutos de avatar incluídos no curso e não há créditos.');
    }
}
