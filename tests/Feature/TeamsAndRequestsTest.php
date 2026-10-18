<?php

namespace Tests\Feature;

use App\Mail\PlatformMail;
use App\Models\Category;
use App\Models\Company;
use App\Models\ContactRequest;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Tests\TestCase;

class TeamsAndRequestsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
        foreach (['aluno', 'formador', 'admin', 'team_leader', 'gestor_cursos'] as $r) {
            Role::firstOrCreate(['name' => $r]);
        }
    }

    private function user(string $role, array $attrs = []): User
    {
        return User::factory()->create(['role_id' => Role::where('name', $role)->value('id'), ...$attrs]);
    }

    private function course(string $title): Course
    {
        $cat = Category::firstOrCreate(['slug' => 'diagnostico-automovel'], ['name' => 'Diagnóstico Automóvel', 'color_hex' => '#F8B101']);

        return Course::create([
            'ulid' => (string) Str::ulid(), 'category_id' => $cat->id, 'title' => $title, 'slug' => Str::slug($title),
            'level' => 'intermedio', 'status' => 'published', 'price' => 49,
        ]);
    }

    private function paidCompanyRequest(Course $course): ContactRequest
    {
        return ContactRequest::create([
            'kind' => 'compra', 'type' => 'empresa', 'status' => 'pago', 'name' => 'Paulo Moura', 'email' => 'paulo@moura.pt',
            'company' => 'Oficina Moura', 'course_id' => $course->id, 'packs' => 1, 'message' => 'Queremos o curso.',
            'people' => [['name' => 'Paulo Moura', 'email' => 'paulo@moura.pt'], ['name' => 'Sérgio Moura', 'email' => 'sergio@moura.pt']],
        ]);
    }

    private function createTeam(User $gestor, ContactRequest $r, Course $course): Company
    {
        $this->actingAs($gestor)->post("/gestao/pedidos/{$r->id}/equipa", [
            'company' => 'Oficina Moura', 'nif' => '516444777', 'packs' => 1, 'course_ids' => [$course->id],
            'people' => $r->people, 'leader' => 'paulo@moura.pt',
        ])->assertRedirect();

        return Company::where('name', 'Oficina Moura')->firstOrFail();
    }

    public function test_each_area_is_only_open_to_its_roles(): void
    {
        $aluno = $this->user('aluno');
        $this->actingAs($aluno)->get('/equipa')->assertForbidden();
        $this->actingAs($aluno)->get('/gestao/pedidos')->assertForbidden();
        $this->actingAs($aluno)->get('/gestao/equipas')->assertForbidden();
        $this->actingAs($this->user('formador'))->get('/gestao/pedidos')->assertForbidden();

        $this->actingAs($this->user('gestor_cursos'))->get('/gestao/pedidos')->assertOk();
        $this->actingAs($this->user('admin'))->get('/gestao/equipas')->assertOk();
        $this->actingAs($this->user('team_leader'))->get('/gestao/pedidos')->assertForbidden();
    }

    public function test_the_bell_is_shared_only_with_course_staff(): void
    {
        ContactRequest::create(['kind' => 'esclarecimento', 'type' => 'particular', 'name' => 'Vasco', 'email' => 'v@x.pt', 'message' => 'Olá']);

        $this->actingAs($this->user('gestor_cursos'))->get('/dashboard')
            ->assertInertia(fn ($page) => $page->where('staffInbox.count', 1));
        $this->actingAs($this->user('aluno'))->get('/dashboard')
            ->assertInertia(fn ($page) => $page->where('staffInbox', null));
    }

    public function test_a_company_contact_with_a_course_becomes_a_purchase_request_and_notifies_staff(): void
    {
        $gestor = $this->user('gestor_cursos');
        $course = $this->course('Diagnóstico OBD-II');

        $this->post('/contactos', [
            'type' => 'empresa', 'name' => 'Paulo Moura', 'email' => 'paulo@moura.pt', 'company' => 'Oficina Moura',
            'course_id' => $course->id, 'message' => 'Queremos o curso para a equipa.', 'consent' => '1',
            'participants' => "Paulo Moura, paulo@moura.pt\nSérgio Moura; sergio@moura.pt\nlinha sem email",
        ])->assertRedirect();

        $r = ContactRequest::firstOrFail();
        $this->assertSame('compra', $r->kind);
        $this->assertSame('novo', $r->status);
        $this->assertSame([['name' => 'Paulo Moura', 'email' => 'paulo@moura.pt'], ['name' => 'Sérgio Moura', 'email' => 'sergio@moura.pt']], $r->people);
        $this->assertCount(1, $r->messages);
        Mail::assertSent(PlatformMail::class, fn ($m) => $m->hasTo($gestor->email));
    }

    public function test_course_staff_creates_the_team_from_a_paid_request(): void
    {
        $gestor = $this->user('gestor_cursos');
        $course = $this->course('Diagnóstico OBD-II');
        $r = $this->paidCompanyRequest($course);

        $company = $this->createTeam($gestor, $r, $course);

        $this->assertSame('equipa_criada', $r->fresh()->status);
        $this->assertSame($company->id, $r->fresh()->company_id);
        $leader = User::where('email', 'paulo@moura.pt')->firstOrFail();
        $this->assertTrue($leader->isTeamLeader());
        $this->assertSame('aluno', User::where('email', 'sergio@moura.pt')->first()->role->name);
        $this->assertSame(2, Enrollment::where('company_id', $company->id)->where('course_id', $course->id)->count());
        Mail::assertSent(PlatformMail::class, 2); // convites
    }

    public function test_a_team_cannot_have_more_people_than_seats(): void
    {
        $gestor = $this->user('gestor_cursos');
        $course = $this->course('Diagnóstico OBD-II');
        $r = $this->paidCompanyRequest($course);
        $people = collect(range(1, 11))->map(fn ($i) => ['name' => "Pessoa {$i}", 'email' => "p{$i}@moura.pt"])->all();

        $this->actingAs($gestor)->post("/gestao/pedidos/{$r->id}/equipa", [
            'company' => 'Oficina Moura', 'packs' => 1, 'course_ids' => [$course->id], 'people' => $people, 'leader' => 'p1@moura.pt',
        ])->assertSessionHasErrors('people');
        $this->assertSame(0, Company::count());
    }

    public function test_the_team_leader_sees_only_team_courses_and_can_request_changes(): void
    {
        $gestor = $this->user('gestor_cursos');
        $team = $this->course('Diagnóstico OBD-II');
        $personal = $this->course('Gestão de Oficina');
        $company = $this->createTeam($gestor, $this->paidCompanyRequest($team), $team);
        $leader = User::where('email', 'paulo@moura.pt')->first();
        // O Sérgio também comprou um curso a título pessoal
        Enrollment::create(['user_id' => User::where('email', 'sergio@moura.pt')->value('id'), 'course_id' => $personal->id, 'source' => 'paid', 'enrolled_at' => now()]);

        $this->actingAs($leader)->get('/equipa')->assertInertia(fn ($page) => $page
            ->component('Team/Show')
            ->where('team.name', 'Oficina Moura')
            ->has('report.courses', 1)
            ->where('report.courses.0.title', 'Diagnóstico OBD-II')
            ->has('report.members', 2));

        $this->actingAs($leader)->post('/equipa/pedidos', ['change_type' => 'adicionar', 'name' => 'Hugo Barros', 'email' => 'hugo@moura.pt'])
            ->assertSessionHasNoErrors();
        $req = ContactRequest::where('kind', 'alteracao')->firstOrFail();
        $this->assertSame($company->id, $req->company_id);
        $this->assertSame([['name' => 'Hugo Barros', 'email' => 'hugo@moura.pt']], $req->people);
    }

    public function test_staff_update_members_and_people_who_leave_lose_team_access(): void
    {
        $gestor = $this->user('gestor_cursos');
        $course = $this->course('Diagnóstico OBD-II');
        $company = $this->createTeam($gestor, $this->paidCompanyRequest($course), $course);
        $sergio = User::where('email', 'sergio@moura.pt')->first();

        $this->actingAs($gestor)->put("/gestao/equipas/{$company->ulid}", [
            'packs' => 1, 'course_ids' => [$course->id], 'leader' => 'paulo@moura.pt',
            'people' => [['name' => 'Paulo Moura', 'email' => 'paulo@moura.pt'], ['name' => 'Hugo Barros', 'email' => 'hugo@moura.pt']],
        ])->assertSessionHasNoErrors();

        $this->assertNull($sergio->fresh()->company_id);
        $this->assertFalse(Enrollment::where('user_id', $sergio->id)->exists());
        $this->assertSame($company->id, User::where('email', 'hugo@moura.pt')->value('company_id'));
    }

    public function test_a_personal_purchase_waits_for_authorization(): void
    {
        $gestor = $this->user('gestor_cursos');
        $aluno = $this->user('aluno');
        $course = $this->course('Diagnóstico OBD-II');

        $this->actingAs($aluno)->post("/cursos/{$course->slug}/comprar")->assertRedirect();
        $r = ContactRequest::firstOrFail();
        $this->assertSame(['compra', 'particular', 'pago'], [$r->kind, $r->type, $r->status]);
        $this->assertFalse($aluno->enrollments()->exists());

        // Uma segunda compra do mesmo curso não cria outro pedido
        $this->actingAs($aluno)->post("/cursos/{$course->slug}/comprar");
        $this->assertSame(1, ContactRequest::count());

        $this->actingAs($gestor)->post("/gestao/pedidos/{$r->id}/autorizar")->assertRedirect();
        $this->assertSame('concluido', $r->fresh()->status);
        $this->assertTrue($aluno->enrollments()->where('course_id', $course->id)->whereNull('company_id')->exists());
    }

    public function test_staff_reply_is_emailed_and_moves_the_request_forward(): void
    {
        $gestor = $this->user('gestor_cursos');
        $r = ContactRequest::create(['kind' => 'esclarecimento', 'type' => 'particular', 'name' => 'Vasco', 'email' => 'vasco@x.pt', 'message' => 'Dá certificado?']);

        $this->actingAs($gestor)->post("/gestao/pedidos/{$r->id}/responder", ['body' => 'Sim, dá certificado.'])->assertRedirect();

        $this->assertSame('em_esclarecimento', $r->fresh()->status);
        $this->assertSame($gestor->id, $r->fresh()->assigned_to);
        Mail::assertSent(PlatformMail::class, fn ($m) => $m->hasTo('vasco@x.pt'));
    }
}
