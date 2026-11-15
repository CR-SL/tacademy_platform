<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Course;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Deploy e contas (revisão V1, grupo 2): dados de demonstração, última atividade. */
class DeployAndAccountsTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_deploy_seed_in_production_creates_only_roles_and_categories(): void
    {
        $this->app['env'] = 'production';
        config(['tacademy.seed_demo' => false]);

        $this->runSeeder();

        $this->assertSame(5, Role::count());
        $this->assertSame(3, Category::count());
        $this->assertSame(0, User::count());
        $this->assertSame(0, Course::count());
    }

    public function test_locally_the_seed_still_creates_the_demo_data(): void
    {
        $this->runSeeder();

        $this->assertTrue(User::where('email', 'admin@tacademy.pt')->exists());
        $this->assertGreaterThan(0, Course::count());
        $this->assertSame(3, Category::count());
    }

    public function test_demo_accounts_outside_local_need_their_own_password(): void
    {
        $this->app['env'] = 'production';
        config(['tacademy.seed_demo' => true, 'tacademy.seed_demo_password' => null]);

        $this->expectException(\RuntimeException::class);
        $this->runSeeder();
    }

    /** O seeder como o deploy o corre (sem a pergunta "estás em produção?" do `db:seed` sem --force). */
    private function runSeeder(): void
    {
        $this->app->make(DatabaseSeeder::class)->setContainer($this->app)->__invoke();
    }

    public function test_using_the_platform_updates_the_last_activity(): void
    {
        $this->seed(\Database\Seeders\RoleSeeder::class);
        $user = User::factory()->create(['role_id' => Role::where('name', 'aluno')->value('id'), 'last_active_at' => null]);

        $this->actingAs($user)->get('/dashboard')->assertOk();
        $first = $user->fresh()->last_active_at;
        $this->assertNotNull($first);

        // No máximo uma escrita a cada 5 minutos
        $this->travel(2)->minutes();
        $this->actingAs($user->fresh())->get('/dashboard');
        $this->assertEquals($first->timestamp, $user->fresh()->last_active_at->timestamp);

        $this->travel(10)->minutes();
        $this->actingAs($user->fresh())->get('/dashboard');
        $this->assertTrue($user->fresh()->last_active_at->gt($first));
    }
}
