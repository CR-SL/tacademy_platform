<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Category;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Role;
use App\Models\User;
use App\Support\Activity;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class ActivityLogTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        foreach (['aluno', 'formador', 'admin', 'team_leader', 'gestor_cursos'] as $r) {
            Role::firstOrCreate(['name' => $r]);
        }
    }

    private function user(string $role = 'aluno', array $attrs = []): User
    {
        return User::factory()->create(['role_id' => Role::where('name', $role)->value('id'), ...$attrs]);
    }

    private function course(array $attrs = []): Course
    {
        $cat = Category::firstOrCreate(['slug' => 'mecanica'], ['name' => 'Mecânica', 'color_hex' => '#F8B101']);

        return Course::create(['ulid' => (string) Str::ulid(), 'category_id' => $cat->id, 'title' => 'Curso OBD', 'slug' => 'curso-obd',
            'level' => 'iniciante', 'status' => 'draft', 'price' => 49.9, ...$attrs]);
    }

    public function test_logins_and_failed_logins_are_recorded_with_the_ip(): void
    {
        $u = $this->user('aluno', ['password' => bcrypt('certa-1234')]);

        $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.7'])
            ->post('/login', ['email' => $u->email, 'password' => 'errada']);
        $failed = ActivityLog::where('action', 'conta.entrada_falhou')->first();
        $this->assertSame('203.0.113.7', $failed->ip);
        $this->assertSame($u->email, $failed->properties['email']);
        $this->assertNull($failed->user_id);

        $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.7'])
            ->post('/login', ['email' => $u->email, 'password' => 'certa-1234']);
        $this->assertDatabaseHas('activity_log', ['action' => 'conta.entrou', 'user_id' => $u->id, 'role' => 'aluno', 'ip' => '203.0.113.7']);
    }

    public function test_course_changes_that_matter_are_recorded_and_autosaves_are_not(): void
    {
        $formador = $this->user('formador');
        $this->actingAs($formador);
        $course = $this->course(['instructor_id' => $formador->id]);

        $course->update(['description' => 'Texto novo']); // gravação automática do editor: não regista
        $course->update(['price' => 39.9]);
        $course->update(['status' => 'published']);

        $this->assertSame(
            ['curso.criado', 'curso.preco_mudado', 'curso.publicado'],
            ActivityLog::where('subject_type', 'curso')->orderBy('id')->pluck('action')->all(),
        );
        $price = ActivityLog::where('action', 'curso.preco_mudado')->first();
        $this->assertSame(['antes' => 49.9, 'depois' => 39.9], $price->properties);
        $this->assertSame('Curso OBD', $price->subject_label);
        $this->assertSame($formador->id, $price->user_id);
    }

    public function test_access_and_role_changes_name_the_person_affected(): void
    {
        $admin = $this->user('admin');
        $student = $this->user();
        $course = $this->course();
        $this->actingAs($admin);

        Enrollment::create(['user_id' => $student->id, 'course_id' => $course->id, 'source' => 'manual', 'enrolled_at' => now()]);
        $student->update(['role_id' => Role::where('name', 'formador')->value('id')]);

        $this->assertDatabaseHas('activity_log', ['action' => 'acesso.dado', 'subject_type' => 'curso', 'related_user_id' => $student->id, 'user_id' => $admin->id]);
        $role = ActivityLog::where('action', 'pessoa.perfil_mudado')->first();
        $this->assertSame(['antes' => 'aluno', 'depois' => 'formador'], $role->properties);
    }

    public function test_after_12_months_rows_are_deleted_but_purchases_keep_without_ip(): void
    {
        $this->actingAs($this->user());
        $old = now()->subMonths(13);
        Activity::log('conta.entrou')->forceFill(['created_at' => $old, 'ip' => '1.2.3.4'])->save();
        Activity::log('compra.pedida')->forceFill(['created_at' => $old, 'ip' => '1.2.3.4'])->save();
        Activity::log('conta.saiu'); // recente: fica como está

        Activity::prune();

        $this->assertNull(ActivityLog::where('action', 'conta.entrou')->first());
        $purchase = ActivityLog::where('action', 'compra.pedida')->first();
        $this->assertNotNull($purchase);
        $this->assertNull($purchase->ip);
        $this->assertNotNull(ActivityLog::where('action', 'conta.saiu')->first());
    }

    public function test_a_deleted_account_is_no_longer_named(): void
    {
        $u = $this->user();
        $this->actingAs($u);
        Activity::log('conta.entrou', $u);
        auth()->logout();

        $u->forceDelete();

        $row = ActivityLog::where('action', 'conta.entrou')->first();
        $this->assertSame('Conta apagada', $row->user_name);
        $this->assertSame('Conta apagada', $row->subject_label);
        $this->assertNull($row->ip);
    }

    public function test_only_the_admin_sees_the_activity_log(): void
    {
        $gestor = $this->user('gestor_cursos');
        Role::where('name', 'gestor_cursos')->first()->forceFill(['permissions' => ['pessoas', 'estatisticas']])->save();
        // Não é uma permissão: quem não é admin é mandado para outra secção
        $to = $this->actingAs($gestor)->get('/administracao/registo')->assertRedirect()->headers->get('Location');
        $this->assertStringNotContainsString('registo', $to);
        $this->actingAs($gestor)->get('/administracao/registo/exportar')->assertForbidden();

        $admin = $this->user('admin');
        $this->actingAs($admin)->get('/administracao/registo')->assertOk()
            ->assertInertia(fn ($p) => $p->component('Admin/Index')->where('section', 'registo')->has('data.rows.data'));
    }

    public function test_the_log_page_filters_by_group_ip_and_person_and_warns_about_failed_logins(): void
    {
        $admin = $this->user('admin');
        $student = $this->user();
        foreach (range(1, 3) as $i) {
            $this->withServerVariables(['REMOTE_ADDR' => '45.155.205.9'])->post('/login', ['email' => "x{$i}@exemplo.test", 'password' => 'errada']);
        }
        $this->actingAs($admin);
        Enrollment::create(['user_id' => $student->id, 'course_id' => $this->course()->id, 'source' => 'manual', 'enrolled_at' => now()]);

        $this->get('/administracao/registo?grupo=contas')->assertInertia(fn ($p) => $p
            ->where('data.watch.ip', '45.155.205.9')->where('data.watch.n', 3)
            ->where('data.rows.data.0.action', 'conta.entrada_falhou')
            ->where('data.rows.data.0.verb', 'falhou a entrada'));
        $this->get('/administracao/registo?ip=45.155&grupo=contas')->assertInertia(fn ($p) => $p->where('data.rows.total', 3));
        $this->get('/administracao/registo?pessoa='.$student->id)->assertInertia(fn ($p) => $p
            ->where('data.person.id', $student->id)
            ->where('data.rows.data.0.action', 'acesso.dado')
            ->where('data.rows.data.0.related.id', $student->id));

        $csv = $this->get('/administracao/registo/exportar?grupo=contas')->assertOk()->streamedContent();
        $this->assertStringContainsString('45.155.205.9', $csv);
        $this->assertDatabaseHas('activity_log', ['action' => 'registo.exportado', 'user_id' => $admin->id]);
    }

    public function test_every_action_the_code_records_has_a_sentence_and_a_group(): void
    {
        $files = ['app/Support/ActivityRecorder.php', 'app/Services/LearningService.php', 'app/Services/TeamService.php',
            'app/Http/Controllers/Staff/TeamController.php', 'app/Http/Controllers/Admin/AdminController.php'];
        $code = collect($files)->map(fn ($f) => file_get_contents(base_path($f)))->implode("\n");
        preg_match_all("/'((?:conta|compra|pedido|acesso|curso|equipa|pessoa|permissoes|area|teste|certificado|registo)\.[a-z_]+)'/", $code, $m);
        $missing = collect($m[1])->unique()->reject(fn ($a) => isset(Activity::ACTIONS[$a]))->values()->all();
        $this->assertSame([], $missing);

        // As compras ganham o estado no fim ('compra.'.$r->status): os estados possíveis também têm frase
        foreach (['pago', 'concluido', 'equipa_criada'] as $status) {
            $this->assertArrayHasKey('compra.'.$status, Activity::ACTIONS);
        }
    }

}
