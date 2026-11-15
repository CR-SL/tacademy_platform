<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Corre em todos os deploys (railway.json: `db:seed --force`).
     * Sempre: perfis e áreas dos cursos (só cria o que falta).
     * Dados de demonstração (contas, cursos, equipas e progresso fictícios): só em local ou com SEED_DEMO=true,
     * para não aparecerem dados falsos em produção nem voltarem a criar aulas que o formador apagou.
     */
    public function run(): void
    {
        $this->call([
            RoleSeeder::class,
            CategorySeeder::class,
        ]);

        if (! self::demoAllowed()) {
            $this->command?->info('Dados de demonstração não criados (só em local ou com SEED_DEMO=true).');

            return;
        }

        $this->call([
            DemoContentSeeder::class,
            DemoTeamsSeeder::class, // equipas, pedidos e progresso fictícios para demonstração
            DemoCourseSeeder::class, // curso completo de demonstração (Mecânica Automóvel)
        ]);
    }

    public static function demoAllowed(): bool
    {
        return app()->environment('local', 'testing') || config('tacademy.seed_demo');
    }

    /**
     * Palavra-passe das contas demo. Fora de local tem de vir de SEED_DEMO_PASSWORD: nunca "password"
     * numa plataforma acessível na internet (incluindo admin@tacademy.pt).
     */
    public static function demoPassword(): string
    {
        $password = config('tacademy.seed_demo_password');
        if (! $password && ! app()->environment('local', 'testing')) {
            throw new \RuntimeException('Define SEED_DEMO_PASSWORD para criar as contas de demonstração fora de local.');
        }

        return $password ?: 'password';
    }
}
