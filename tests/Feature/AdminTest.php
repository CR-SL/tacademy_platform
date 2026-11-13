<?php

namespace Tests\Feature;

use App\Mail\PlatformMail;
use App\Models\Category;
use App\Models\Company;
use App\Models\ContactRequest;
use App\Models\Course;
use App\Models\CourseView;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Tests\TestCase;

/** Administração: estatísticas, pessoas, permissões por perfil e contagem de cliques no catálogo. */
class AdminTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        foreach (['aluno', 'formador', 'admin', 'team_leader', 'gestor_cursos'] as $r) {
            Role::firstOrCreate(['name' => $r]);
        }
    }

    private function user(string $role, array $attrs = []): User
    {
        return User::factory()->create(['role_id' => Role::where('name', $role)->value('id'), ...$attrs]);
    }

    private function course(array $attrs = []): Course
    {
        $cat = Category::firstOrCreate(['slug' => 'diagnostico'], ['name' => 'Diagnóstico Automóvel', 'color_hex' => '#F8B101']);

        return Course::create(['ulid' => (string) Str::ulid(), 'category_id' => $cat->id, 'title' => 'OBD-II', 'slug' => 'obd-ii-'.Str::random(4), 'level' => 'iniciante', 'status' => 'published', 'price' => 49.9, ...$attrs]);
    }

    public function test_only_people_with_permission_open_the_administration(): void
    {
        $this->actingAs($this->user('aluno'))->get('/administracao')->assertForbidden();
        // O gestor de cursos só vê a secção Formador IA (desligar e bloquear o avatar)
        $gestor = $this->user('gestor_cursos');
        $this->actingAs($gestor)->get('/administracao')->assertOk()->assertInertia(fn ($p) => $p->where('section', 'formador-ia')->where('sections', ['formador-ia']));
        $this->actingAs($gestor)->get('/administracao/pessoas')->assertRedirect('/administracao/formador-ia');

        $admin = $this->user('admin');
        foreach (['geral', 'vendas', 'cliques', 'conclusao', 'catalogo', 'pessoas', 'permissoes'] as $s) {
            $this->actingAs($admin)->get("/administracao/{$s}")->assertOk()->assertInertia(fn ($p) => $p->component('Admin/Index')->where('section', $s));
        }
    }

    public function test_sales_and_clicks_come_from_the_database(): void
    {
        $course = $this->course();
        $buyer = $this->user('aluno');
        ContactRequest::create(['kind' => 'compra', 'type' => 'particular', 'status' => 'pago', 'name' => 'Ana', 'email' => 'a@x.pt', 'message' => 'Compra', 'course_id' => $course->id, 'user_id' => $buyer->id]);
        ContactRequest::create(['kind' => 'compra', 'type' => 'particular', 'status' => 'cancelado', 'name' => 'Rui', 'email' => 'r@x.pt', 'message' => 'Compra', 'course_id' => $course->id]);
        CourseView::create(['course_id' => $course->id, 'user_id' => $buyer->id]);

        $this->actingAs($this->user('admin'))->get('/administracao')->assertInertia(fn ($p) => $p
            ->where('data.overview.sales', 1)
            ->where('data.overview.revenue', 49.9)
            ->where('data.overview.views', 1));
        $this->actingAs($this->user('admin'))->get("/administracao/cursos/{$course->ulid}")->assertInertia(fn ($p) => $p
            ->component('Admin/Course')->where('stats.sales', 1)->where('stats.views', 1));
    }

    public function test_opening_a_course_in_the_catalog_counts_once_every_30_minutes(): void
    {
        $course = $this->course();
        $u = $this->user('aluno');
        $this->actingAs($u)->post("/plataforma/cursos/{$course->slug}/visto")->assertNoContent();
        $this->actingAs($u)->post("/plataforma/cursos/{$course->slug}/visto")->assertNoContent();
        $this->assertSame(1, CourseView::count());
        auth()->logout();
        $this->post("/plataforma/cursos/{$course->slug}/visto")->assertRedirect(); // sem sessão não conta
        $this->assertSame(1, CourseView::count());
    }

    public function test_admin_adds_a_person_who_gets_an_invitation(): void
    {
        Mail::fake();
        $this->actingAs($this->user('admin'))->post('/administracao/pessoas', ['name' => 'Rita Lopes', 'email' => 'rita@oficina.pt', 'role' => 'formador'])
            ->assertSessionHasNoErrors();
        $rita = User::where('email', 'rita@oficina.pt')->first();
        $this->assertTrue($rita->hasRole('formador'));
        Mail::assertSent(PlatformMail::class, fn ($m) => $m->hasTo('rita@oficina.pt') && $m->actionText === 'Definir palavra-passe');

        $this->actingAs($this->user('admin'))->post('/administracao/pessoas', ['name' => 'Outra', 'email' => 'rita@oficina.pt', 'role' => 'aluno'])->assertSessionHasErrors('email');
    }

    public function test_profiles_have_guards(): void
    {
        $admin = $this->user('admin');
        // Não muda o próprio perfil, nem fica a plataforma sem admin
        $this->actingAs($admin)->put("/administracao/pessoas/{$admin->ulid}", ['name' => $admin->name, 'email' => $admin->email, 'role' => 'aluno'])->assertSessionHasErrors('role');
        // Team leader só com empresa
        $u = $this->user('aluno');
        $this->actingAs($admin)->put("/administracao/pessoas/{$u->ulid}", ['name' => $u->name, 'email' => $u->email, 'role' => 'team_leader'])->assertSessionHasErrors('role');
        $u->forceFill(['company_id' => Company::create(['name' => 'Oficina X', 'packs' => 1])->id])->save();
        $this->actingAs($admin)->put("/administracao/pessoas/{$u->ulid}", ['name' => $u->name, 'email' => $u->email, 'role' => 'team_leader'])->assertSessionHasNoErrors();
        $this->assertTrue($u->fresh()->hasRole('team_leader'));
    }

    public function test_deactivated_people_cannot_sign_in_until_reactivated(): void
    {
        $admin = $this->user('admin');
        $u = $this->user('aluno', ['email' => 'joao@oficina.pt']);
        $this->actingAs($admin)->delete("/administracao/pessoas/{$u->ulid}")->assertSessionHasNoErrors();
        $this->assertSoftDeleted($u);
        $this->actingAs($admin)->delete("/administracao/pessoas/{$admin->ulid}")->assertStatus(422);

        auth()->logout();
        $this->post('/login', ['email' => 'joao@oficina.pt', 'password' => 'password'])->assertSessionHasErrors();

        $this->actingAs($admin)->post("/administracao/pessoas/{$u->id}/reativar");
        $this->assertNotSoftDeleted($u);
    }

    public function test_permissions_change_what_each_profile_can_do(): void
    {
        $admin = $this->user('admin');
        $formador = $this->user('formador');
        $gestor = $this->user('gestor_cursos');
        $this->actingAs($formador)->get('/formador/cursos')->assertOk();

        // O formador deixa de poder criar cursos; o gestor passa a ver as estatísticas
        $this->actingAs($admin)->put('/administracao/permissoes', ['role' => 'formador', 'permissions' => ['cursos.publicar']])->assertSessionHasNoErrors();
        $this->actingAs($admin)->put('/administracao/permissoes', ['role' => 'gestor_cursos', 'permissions' => ['pedidos', 'equipas', 'estatisticas']])->assertSessionHasNoErrors();
        $this->actingAs($formador->fresh())->get('/formador/cursos')->assertForbidden();
        $this->actingAs($gestor->fresh())->get('/administracao')->assertOk();
        $this->actingAs($gestor->fresh())->get('/administracao/pessoas')->assertRedirect('/administracao/geral');

        // O admin tem sempre tudo e não se mexe
        $this->actingAs($admin)->put('/administracao/permissoes', ['role' => 'admin', 'permissions' => []])->assertSessionHasErrors('role');
        $this->actingAs($admin)->put('/administracao/permissoes', ['role' => 'aluno', 'permissions' => ['inventada']])->assertSessionHasErrors('permissions.0');
        $this->actingAs($this->user('gestor_cursos'))->put('/administracao/permissoes', ['role' => 'aluno', 'permissions' => []])->assertForbidden();
    }

    public function test_admin_manages_course_areas(): void
    {
        $admin = $this->user('admin');
        $this->actingAs($admin)->post('/administracao/areas', ['name' => 'Pneus e Jantes'])->assertSessionHasNoErrors();
        $area = Category::where('name', 'Pneus e Jantes')->first();
        $this->assertSame('pneus-e-jantes', $area->slug);
        $this->actingAs($admin)->post('/administracao/areas', ['name' => 'Pneus e Jantes'])->assertSessionHasErrors('name');

        // Mudar o nome não muda o endereço
        $this->actingAs($admin)->put("/administracao/areas/{$area->id}", ['name' => 'Pneus'])->assertSessionHasNoErrors();
        $this->assertSame(['Pneus', 'pneus-e-jantes'], [$area->fresh()->name, $area->fresh()->slug]);

        // Uma área com cursos não se apaga; sem cursos, sim
        $this->course(['category_id' => $area->id]);
        $this->actingAs($admin)->delete("/administracao/areas/{$area->id}")->assertSessionHasErrors('area');
        $empty = Category::create(['name' => 'Vazia', 'slug' => 'vazia']);
        $this->actingAs($admin)->delete("/administracao/areas/{$empty->id}")->assertSessionHasNoErrors();
        $this->assertSoftDeleted($empty);

        // Só quem gere todos os cursos
        $this->actingAs($this->user('formador'))->post('/administracao/areas', ['name' => 'Outra'])->assertForbidden();
    }

    public function test_a_trainer_without_the_publish_permission_cannot_publish(): void
    {
        $formador = $this->user('formador');
        $course = $this->course(['status' => 'draft', 'instructor_id' => $formador->id]);
        $this->actingAs($this->user('admin'))->put('/administracao/permissoes', ['role' => 'formador', 'permissions' => ['cursos.criar']]);
        $this->actingAs($formador->fresh())->post("/formador/cursos/{$course->ulid}/publicar")->assertForbidden();
    }
}
