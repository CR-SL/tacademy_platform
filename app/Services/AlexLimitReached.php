<?php

namespace App\Services;

use RuntimeException;

/** O aluno já usou as conversas com o Alex de hoje. */
class AlexLimitReached extends RuntimeException
{
    public function __construct(public readonly int $perDay)
    {
        parent::__construct("Limite de {$perDay} conversas por dia.");
    }
}
