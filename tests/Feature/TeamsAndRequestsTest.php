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
        $company = Company::where('name', 'Oficina Moura')->firstOrFail();
        // Os membros aceitam o convite (definir a palavra-passe confirma o email)
        User::where('company_id', $company->id)->whereNull('email_verified_at')->update(['email_verified_at' => now()]);

        return $company;
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

        $this->actingAs($this->user('gestor_cursos'))->get('/gestao/pedidos')
            ->assertInertia(fn ($page) => $page->where('staffInbox.count', 1));
        $this->actingAs($this->user('aluno'))->get('/dashboard')
            ->assertInertia(fn ($page) => $page->where('staffInbox', null));
    }

    public function test_a_company_contact_with_a_course_becomes_a_purchase_request_and_notifies_staff(): void
    {
        $gestor = $this->user('gestor_cursos');
        $course = $this->course('Diagnóstico OBD-II');

        $this->post('/plataforma/contactos', [
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

        $this->assertNotNull($sergio->fresh()); // a conta nunca é apagada
        $this->assertNull($sergio->fresh()->company_id);
        $this->assertFalse(Enrollment::where('user_id', $sergio->id)->exists()); // curso da equipa por concluir: perde o acesso
        $this->assertSame($company->id, User::where('email', 'hugo@moura.pt')->value('company_id'));
    }

    public function test_leaving_the_team_keeps_a_course_bought_personally(): void
    {
        $gestor = $this->user('gestor_cursos');
        $course = $this->course('Diagnóstico OBD-II');
        $other = $this->course('Baterias de Alta Tensão');
        // O Sérgio já tinha comprado o OBD-II antes de a empresa o incluir na equipa
        $sergio = $this->user('aluno', ['email' => 'sergio@moura.pt', 'name' => 'Sérgio Moura']);
        app(\App\Services\TeamService::class)->enroll($sergio, $course->id, null);
        $company = $this->createTeam($gestor, $this->paidCompanyRequest($course), $course);
        $this->assertSame($company->id, Enrollment::where('user_id', $sergio->id)->value('company_id'));

        // A equipa troca de curso: o Paulo perde o OBD-II, o Sérgio não (é dele)
        $paulo = User::where('email', 'paulo@moura.pt')->first();
        $this->actingAs($gestor)->put("/gestao/equipas/{$company->ulid}", [
            'packs' => 1, 'course_ids' => [$other->id], 'leader' => 'paulo@moura.pt', 'people' => $this->paidCompanyRequest($course)->people,
        ])->assertSessionHasNoErrors();
        $this->assertFalse(Enrollment::where('user_id', $paulo->id)->where('course_id', $course->id)->exists());
        $mine = Enrollment::where('user_id', $sergio->id)->where('course_id', $course->id)->first();
        $this->assertNotNull($mine);
        $this->assertNull($mine->company_id);

        // O Sérgio sai da equipa: perde o curso da equipa, mantém o que comprou
        $this->actingAs($gestor)->put("/gestao/equipas/{$company->ulid}", [
            'packs' => 1, 'course_ids' => [$other->id], 'leader' => 'paulo@moura.pt', 'people' => [['name' => 'Paulo Moura', 'email' => 'paulo@moura.pt']],
        ])->assertSessionHasNoErrors();
        $this->assertSame([$course->id], Enrollment::where('user_id', $sergio->id)->pluck('course_id')->all());
    }

    public function test_leaving_the_team_keeps_the_account_and_finished_courses_with_their_certificate(): void
    {
        $gestor = $this->user('gestor_cursos');
        $course = $this->course('Diagnóstico OBD-II');
        $other = $this->course('Baterias de Alta Tensão');
        $third = $this->course('Gestão de Oficina');
        $company = $this->createTeam($gestor, $this->paidCompanyRequest($course), $course);
        $people = $this->paidCompanyRequest($course)->people;
        $this->actingAs($gestor)->put("/gestao/equipas/{$company->ulid}", [
            'packs' => 1, 'course_ids' => [$course->id, $other->id, $third->id], 'leader' => 'paulo@moura.pt', 'people' => $people,
        ])->assertSessionHasNoErrors();

        // O Sérgio concluiu o OBD-II, tem o certificado das Baterias e ainda não acabou a Gestão
        $sergio = User::where('email', 'sergio@moura.pt')->first();
        Enrollment::where('user_id', $sergio->id)->where('course_id', $course->id)->update(['status' => 'completed', 'completed_at' => now()]);
        \App\Models\Certificate::create(['user_id' => $sergio->id, 'course_id' => $other->id, 'certificate_number' => 'TA-2026-SER001', 'status' => 'valid', 'issued_at' => now()]);

        $this->actingAs($gestor)->put("/gestao/equipas/{$company->ulid}", [
            'packs' => 1, 'course_ids' => [$course->id, $other->id, $third->id], 'leader' => 'paulo@moura.pt',
            'people' => [['name' => 'Paulo Moura', 'email' => 'paulo@moura.pt']],
        ])->assertSessionHasNoErrors();

        // A conta fica; mantém os dois cursos acabados (já não contam para a empresa) e o certificado
        $this->assertNotNull($sergio->fresh());
        $this->assertNull($sergio->fresh()->company_id);
        $kept = Enrollment::where('user_id', $sergio->id)->orderBy('course_id')->get();
        $this->assertSame([$course->id, $other->id], $kept->pluck('course_id')->all());
        $this->assertSame([null, null], $kept->pluck('company_id')->all());
        $this->assertTrue(\App\Models\Certificate::where('user_id', $sergio->id)->where('course_id', $other->id)->exists());
    }

    public function test_a_disabled_account_in_the_list_is_refused_and_nobody_is_invited(): void
    {
        $gestor = $this->user('gestor_cursos');
        $course = $this->course('Diagnóstico OBD-II');
        $this->user('aluno', ['email' => 'sergio@moura.pt'])->delete(); // conta desativada pela Administração
        $r = $this->paidCompanyRequest($course);

        $this->actingAs($gestor)->post("/gestao/pedidos/{$r->id}/equipa", [
            'company' => 'Oficina Moura', 'nif' => '516444777', 'packs' => 1, 'course_ids' => [$course->id],
            'people' => $r->people, 'leader' => 'paulo@moura.pt',
        ])->assertSessionHasErrors('people');

        $this->assertFalse(Company::where('name', 'Oficina Moura')->exists());
        $this->assertFalse(User::where('email', 'paulo@moura.pt')->exists());
        Mail::assertNothingSent();
    }

    public function test_a_draft_course_cannot_be_added_to_a_team(): void
    {
        $gestor = $this->user('gestor_cursos');
        $course = $this->course('Diagnóstico OBD-II');
        $draft = $this->course('Em preparação');
        $draft->update(['status' => 'draft']);
        $company = $this->createTeam($gestor, $this->paidCompanyRequest($course), $course);

        $this->actingAs($gestor)->put("/gestao/equipas/{$company->ulid}", [
            'packs' => 1, 'course_ids' => [$course->id, $draft->id], 'leader' => 'paulo@moura.pt', 'people' => $this->paidCompanyRequest($course)->people,
        ])->assertSessionHasErrors('course_ids.1');

        // Um curso que a equipa já tem continua aceite, mesmo que tenha passado a rascunho
        $course->update(['status' => 'draft']);
        $this->actingAs($gestor)->put("/gestao/equipas/{$company->ulid}", [
            'packs' => 1, 'course_ids' => [$course->id], 'leader' => 'paulo@moura.pt', 'people' => $this->paidCompanyRequest($course)->people,
        ])->assertSessionHasNoErrors();
    }

    public function test_authorizing_twice_gives_access_or_credits_only_once(): void
    {
        $gestor = $this->user('gestor_cursos');
        $aluno = $this->user('aluno', ['alex_credits' => 0]);
        $r = ContactRequest::create(['kind' => 'creditos', 'type' => 'particular', 'status' => 'pago', 'name' => $aluno->name, 'email' => $aluno->email, 'user_id' => $aluno->id, 'credits' => 10, 'message' => 'Créditos']);

        $this->actingAs($gestor)->post("/gestao/pedidos/{$r->id}/autorizar")->assertRedirect();
        // O segundo clique não dá os créditos outra vez
        $this->assertSame(10, $aluno->fresh()->alex_credits);
        $this->actingAs($gestor)->post("/gestao/pedidos/{$r->id}/autorizar");
        $this->assertSame(10, $aluno->fresh()->alex_credits);
        $this->assertSame('concluido', $r->fresh()->status);
    }

    public function test_pending_changes_carry_their_type_for_any_language(): void
    {
        $gestor = $this->user('gestor_cursos');
        $course = $this->course('Diagnóstico OBD-II');
        $company = $this->createTeam($gestor, $this->paidCompanyRequest($course), $course);
        ContactRequest::create(['kind' => 'alteracao', 'type' => 'empresa', 'status' => 'novo', 'name' => 'Paulo', 'email' => 'paulo@moura.pt',
            'company_id' => $company->id, 'change_type' => 'adicionar', 'people' => [['name' => 'Hugo', 'email' => 'hugo@moura.pt']], 'message' => 'Novo']);

        $this->actingAs($gestor)->get("/gestao/equipas/{$company->ulid}")
            ->assertInertia(fn ($p) => $p->where('pending.0.change_type', 'adicionar'));
    }

    public function test_a_refused_team_update_changes_nothing(): void
    {
        $gestor = $this->user('gestor_cursos');
        $course = $this->course('Diagnóstico OBD-II');
        $other = $this->course('Baterias de Alta Tensão');
        $company = $this->createTeam($gestor, $this->paidCompanyRequest($course), $course);
        $before = Enrollment::where('company_id', $company->id)->count();

        // Troca o curso e põe 11 pessoas em 10 lugares: é recusado e nada muda
        $people = collect(range(1, 11))->map(fn ($i) => ['name' => "Pessoa $i", 'email' => "p$i@moura.pt"])->all();
        $people[0] = ['name' => 'Paulo Moura', 'email' => 'paulo@moura.pt'];
        $this->actingAs($gestor)->put("/gestao/equipas/{$company->ulid}", [
            'packs' => 1, 'course_ids' => [$other->id], 'leader' => 'paulo@moura.pt', 'people' => $people,
        ])->assertSessionHasErrors('people');

        $company->refresh();
        $this->assertSame([$course->id], $company->courses()->pluck('courses.id')->all());
        $this->assertSame($before, Enrollment::where('company_id', $company->id)->where('course_id', $course->id)->count());
        $this->assertFalse(User::where('email', 'p2@moura.pt')->exists());
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

    public function test_the_team_leader_assigns_a_course_with_a_deadline_and_sends_reminders(): void
    {
        $course = $this->course('Diagnóstico OBD');
        $company = $this->createTeam($this->user('gestor_cursos'), $this->paidCompanyRequest($course), $course);
        $leader = User::where('email', 'paulo@moura.pt')->first();
        $sergio = User::where('email', 'sergio@moura.pt')->first();
        $outsider = $this->user('aluno');
        Mail::fake();

        // Só pessoas da equipa e cursos da equipa
        $this->actingAs($leader)->post('/equipa/atribuir', ['course_id' => $course->id, 'members' => [$outsider->id]])->assertSessionHasErrors('members.0');
        $other = $this->course('Outro curso');
        $this->actingAs($leader)->post('/equipa/atribuir', ['course_id' => $other->id, 'members' => [$sergio->id]])->assertSessionHasErrors('course_id');
        $this->actingAs($leader)->post('/equipa/atribuir', ['course_id' => $course->id, 'members' => [$sergio->id], 'due_at' => now()->toDateString()])->assertSessionHasErrors('due_at');

        $due = now()->addDays(15)->toDateString();
        $this->actingAs($leader)->post('/equipa/atribuir', ['course_id' => $course->id, 'members' => [$sergio->id], 'due_at' => $due, 'message' => 'Antes da auditoria.'])
            ->assertSessionHasNoErrors();
        $e = Enrollment::where('user_id', $sergio->id)->where('course_id', $course->id)->first();
        $this->assertSame($due, $e->due_at->toDateString());
        $this->assertSame($leader->id, $e->assigned_by);
        Mail::assertSent(PlatformMail::class, fn ($m) => $m->hasTo('sergio@moura.pt') && str_contains($m->subjectLine, 'Diagnóstico OBD') && $m->quote === 'Antes da auditoria.');

        // Atribuir outra vez sem data mantém o prazo
        $this->actingAs($leader)->post('/equipa/atribuir', ['course_id' => $course->id, 'members' => [$sergio->id]])->assertSessionHasNoErrors();
        $this->assertSame($due, $e->fresh()->due_at->toDateString());

        // O aluno vê o prazo da empresa
        $this->actingAs($sergio)->get('/plataforma/meus-cursos')->assertInertia(fn ($p) => $p->where('courses.0.deadline.by', 'empresa'));

        // Lembrete: um de cada vez, sem repetir no mesmo dia
        Mail::fake();
        $this->actingAs($leader)->post('/equipa/lembretes', ['course_id' => $course->id, 'members' => [$sergio->id]])->assertSessionHas('status', 'Lembrete enviado.');
        Mail::assertSent(PlatformMail::class, fn ($m) => $m->hasTo('sergio@moura.pt') && str_starts_with($m->subjectLine, 'Lembrete'));
        $this->assertNotNull($e->fresh()->reminded_at);

        Mail::fake();
        $this->actingAs($leader)->post('/equipa/lembretes', ['course_id' => $course->id, 'members' => [$sergio->id]]);
        Mail::assertNothingSent();

        $this->actingAs($leader)->get('/equipa')->assertInertia(fn ($p) => $p
            ->where("report.members.1.courses.{$course->id}.remindable", false)
            ->where("report.members.1.courses.{$course->id}.due", now()->addDays(15)->format('d/m/Y')));

        // Um aluno não usa estas ações
        $this->actingAs($sergio)->post('/equipa/lembretes', ['course_id' => $course->id, 'members' => [$leader->id]])->assertForbidden();
    }

    public function test_a_student_can_turn_off_the_team_leader_reminders(): void
    {
        $course = $this->course('Diagnóstico OBD');
        $company = $this->createTeam($this->user('gestor_cursos'), $this->paidCompanyRequest($course), $course);
        $leader = User::where('email', 'paulo@moura.pt')->first();
        $sergio = User::where('email', 'sergio@moura.pt')->first();

        // Nas Definições, quem está numa equipa vê a opção e desliga os lembretes
        $this->actingAs($sergio)->get('/definicoes')->assertInertia(fn ($p) => $p->where('inTeam', true));
        $this->actingAs($sergio)->putJson('/definicoes/notificacoes', ['reminders' => false])->assertNoContent();
        $this->assertFalse($sergio->fresh()->email_reminders);

        // O team leader vê que desligou e o lembrete não sai
        $this->actingAs($leader)->get('/equipa')->assertInertia(fn ($p) => $p
            ->where('report.members.1.remindersOff', true)
            ->where("report.members.1.courses.{$course->id}.remindable", false));
        Mail::fake();
        $this->actingAs($leader)->post('/equipa/lembretes', ['course_id' => $course->id, 'members' => [$sergio->id]])
            ->assertSessionHas('status', 'Nenhum lembrete enviado: quem escolheste já concluiu o curso, recebeu um lembrete há pouco ou desligou os lembretes.');
        Mail::assertNothingSent();

        // Os cursos atribuídos continuam a chegar por email
        $this->actingAs($leader)->post('/equipa/atribuir', ['course_id' => $course->id, 'members' => [$sergio->id]])->assertSessionHasNoErrors();
        Mail::assertSent(PlatformMail::class, fn ($m) => $m->hasTo('sergio@moura.pt'));

        // Volta a ligar
        $this->actingAs($sergio)->putJson('/definicoes/notificacoes', ['reminders' => true])->assertNoContent();
        $this->assertTrue($sergio->fresh()->email_reminders);
    }
}
