<?php

namespace App\Models\Concerns;

use Illuminate\Support\Str;

/**
 * Preenche automaticamente a coluna `ulid` ao criar o registo e permite
 * resolver o modelo por ULID nas rotas (identificador exposto em URLs, em
 * vez do id incremental) — ver higiene de fundação no PLANEAMENTO.md.
 */
trait HasUlid
{
    protected static function bootHasUlid(): void
    {
        static::creating(function ($model) {
            if (empty($model->ulid)) {
                $model->ulid = (string) Str::ulid();
            }
        });
    }

    public function getRouteKeyName(): string
    {
        return 'ulid';
    }
}
