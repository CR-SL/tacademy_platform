<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call([
            RoleSeeder::class,
            DemoContentSeeder::class,
            DemoTeamsSeeder::class, // equipas, pedidos e progresso fictícios para demonstração
        ]);
    }
}
