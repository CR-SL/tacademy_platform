<?php

namespace Database\Seeders;

use App\Models\Category;
use Illuminate\Database\Seeder;

/** Áreas dos cursos. Corre em todos os deploys (também em produção): só cria as que faltam, não altera as que existem. */
class CategorySeeder extends Seeder
{
    public function run(): void
    {
        $categories = [
            'diagnostico-automovel' => ['name' => 'Diagnóstico Automóvel', 'color_hex' => '#2F6FED', 'icon' => 'wrench-screwdriver'],
            'eletronica-automovel' => ['name' => 'Eletrónica Automóvel', 'color_hex' => '#22D3EE', 'icon' => 'cpu-chip'],
            'gestao-de-oficina' => ['name' => 'Gestão de Oficina', 'color_hex' => '#E8940F', 'icon' => 'briefcase'],
        ];
        foreach ($categories as $slug => $attrs) {
            Category::withTrashed()->firstOrCreate(['slug' => $slug], $attrs);
        }
    }
}
