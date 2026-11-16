<?php

namespace App\Support;

/**
 * Exportações CSV abertas no Excel. Um texto que comece por = + - @ (ou tab / mudança de linha) é lido como fórmula:
 * um nome ou um "browser" como =HYPERLINK(...) corria no computador de quem abre o ficheiro. Esses textos levam
 * um apóstrofo à frente, para o Excel os mostrar tal como estão. (O mesmo em resources/js/Components/Teams/TeamReport.jsx.)
 */
class Csv
{
    public static function cell(mixed $value): mixed
    {
        if (! is_string($value) || $value === '') {
            return $value;
        }

        return in_array($value[0], ['=', '+', '-', '@', "\t", "\r"], true) ? "'".$value : $value;
    }

    /** @param  array<int, mixed>  $row */
    public static function row(array $row): array
    {
        return array_map(self::cell(...), $row);
    }
}
