<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\ContactRequest;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Dados de demonstração para "Equipa", "Pedidos" e "Equipas" (como no exemplo equipas-pedidos.html),
 * para a equipa ver as páginas com conteúdo. Tudo fictício (emails em domínios .demo, que não existem).
 * Corre só uma vez: se a equipa "Auto Silva, Lda" já existir, não faz nada.
 *
 * Contas para entrar (password: a de SEED_DEMO_PASSWORD, "password" em local):
 *  - teamleader@tacademy.pt  → team leader da Auto Silva
 *  - gestorcursos@tacademy.pt → gestor de cursos (criado no DemoContentSeeder)
 */
class DemoTeamsSeeder extends Seeder
{
    private array $roles;

    private string $password;

    public function run(): void
    {
        if (Company::withTrashed()->where('name', 'Auto Silva, Lda')->exists()) {
            return;
        }
        $courses = Course::pluck('id', 'slug');
        $obd = $courses['diagnostico-de-sistemas-obd-ii'] ?? null;
        $can = $courses['redes-can-bus-no-automovel'] ?? null;
        $gestao = $courses['gestao-de-oficina-moderna'] ?? null;
        $baterias = $courses['baterias-e-sistemas-de-carga'] ?? null;
        if (! $obd || ! $can || ! $gestao || ! $baterias) {
            return; // precisa dos cursos do DemoContentSeeder
        }

        $this->roles = Role::pluck('id', 'name')->all();
        $this->password = Hash::make(env('SEED_DEMO_PASSWORD', 'password'));
        $gestor = User::where('email', 'gestorcursos@tacademy.pt')->first();

        DB::transaction(function () use ($obd, $can, $gestao, $baterias, $gestor) {
            // --- Equipa 1: Auto Silva (1 pack, 2 cursos) ---
            $silva = $this->team('Auto Silva, Lda', '509123456', 'Braga', 1, [$obd, $can], 16);
            $this->member($silva, 'Rui Silva', 'teamleader@tacademy.pt', [$obd => 100, $can => 40], 0, true);
            $this->member($silva, 'Marta Costa', 'marta@autosilva.demo', [$obd => 100, $can => 75], 1);
            $this->member($silva, 'João Pereira', 'joao@autosilva.demo', [$obd => 60, $can => 0], 3);
            $this->member($silva, 'Tiago Santos', 'tiago@autosilva.demo', [$obd => 20, $can => 0], 14);
            $this->member($silva, 'Inês Moreira', 'ines@autosilva.demo', [$obd => 80, $can => 33], 2);
            $this->member($silva, 'Pedro Lima', 'pedro@autosilva.demo', [], null);
            $this->member($silva, 'Carla Rocha', 'carla@autosilva.demo', [$obd => 100, $can => 100], 0);
            $this->member($silva, 'Nuno Alves', 'nuno@autosilva.demo', [$obd => 40, $can => 0], 5);

            // --- Equipa 2: Garagem Central do Porto (2 packs, 1 curso) ---
            $porto = $this->team('Garagem Central do Porto', '512987654', 'Porto', 2, [$gestao], 20);
            $names = ['Ana Ferreira', 'Bruno Dias', 'Sofia Ramos', 'Hugo Matos', 'Rita Gomes', 'Luís Neves', 'Paula Faria',
                'Diogo Cruz', 'Vera Lopes', 'André Reis', 'Joana Pinto', 'Filipe Sousa', 'Sara Melo', 'Miguel Costa'];
            $prog = [100, 67, 100, 33, 67, 0, 100, 33, 100, 67, 67, 33, 100, 0];
            foreach ($names as $i => $name) {
                $this->member($porto, $name, Str::slug($name, '.').'@gcporto.demo', $prog[$i] ? [$gestao => $prog[$i]] : [], $prog[$i] ? ($i % 4) : null, $i === 0);
            }

            // --- Equipa 3: Mecânica Rápida Algarve (acabada de criar) ---
            $algarve = $this->team('Mecânica Rápida Algarve', '515222333', 'Faro', 1, [$baterias], 2);
            $this->member($algarve, 'Carlos Viegas', 'carlos@mra.demo', [$baterias => 33], 1, true);
            $this->member($algarve, 'Duarte Guerreiro', 'duarte@mra.demo', [], null);
            $this->member($algarve, 'Lara Pires', 'lara@mra.demo', [$baterias => 0], 2);

            // --- Alunos individuais (cursos comprados a título pessoal) ---
            $joana = $this->user('Joana Freitas', 'joana.freitas@particular.demo', 'aluno', null, 0);
            $this->enroll($joana, $obd, null, 100, 0);
            $this->enroll($joana, $baterias, null, 33, 0);
            $ricardo = $this->user('Ricardo Baptista', 'ricardo.baptista@particular.demo', 'aluno', null, 6);
            $this->enroll($ricardo, $can, null, 67, 6);
            // A Marta é da Auto Silva mas comprou este curso para si: o team leader não o vê
            $this->enroll(User::where('email', 'marta@autosilva.demo')->first(), $gestao, null, 33, 1);

            // --- Pedidos ---
            $this->request([
                'kind' => 'compra', 'type' => 'empresa', 'status' => 'novo', 'name' => 'Paulo Moura', 'email' => 'paulo@mourafilhos.demo',
                'phone' => '912 345 678', 'company' => 'Oficina Moura & Filhos', 'nif' => '516444777', 'team_size' => '6-20', 'course_id' => $obd, 'packs' => 1,
                'people' => [['name' => 'Paulo Moura', 'email' => 'paulo@mourafilhos.demo'], ['name' => 'Sérgio Moura', 'email' => 'sergio@mourafilhos.demo'],
                    ['name' => 'Rafael Teixeira', 'email' => 'rafael@mourafilhos.demo'], ['name' => 'Bruno Lopes', 'email' => 'bruno@mourafilhos.demo'],
                    ['name' => 'Daniel Matias', 'email' => 'daniel@mourafilhos.demo'], ['name' => 'Fábio Correia', 'email' => 'fabio@mourafilhos.demo']],
                'message' => 'Bom dia. Somos uma oficina com 6 técnicos e queríamos o curso de OBD-II para a equipa toda. Envio a lista. Como funciona o pagamento?',
            ], [], 0);

            $this->request([
                'kind' => 'alteracao', 'type' => 'empresa', 'status' => 'novo', 'name' => 'Rui Silva', 'email' => 'teamleader@tacademy.pt',
                'company' => 'Auto Silva, Lda', 'company_id' => $silva->id, 'user_id' => User::where('email', 'teamleader@tacademy.pt')->value('id'),
                'change_type' => 'adicionar', 'people' => [['name' => 'Hugo Barros', 'email' => 'hugo@autosilva.demo']],
                'message' => 'Entrou um técnico novo, o Hugo. Podem incluí-lo na equipa? Ainda temos 2 lugares livres.',
            ], [], 0);

            $this->request([
                'kind' => 'esclarecimento', 'type' => 'particular', 'status' => 'em_esclarecimento', 'name' => 'Vasco Henriques',
                'email' => 'vasco.h@particular.demo', 'course_id' => $can, 'assigned_to' => $gestor?->id,
                'message' => 'O curso de CAN Bus dá certificado reconhecido?',
            ], [[$gestor?->name ?? 'Gestor de cursos', 'Olá Vasco, sim — no fim do curso recebe um certificado T.Academy com código de verificação.']], 1);

            $this->request([
                'kind' => 'compra', 'type' => 'empresa', 'status' => 'pago', 'name' => 'Teresa Nunes', 'email' => 'teresa@pneusecia.demo',
                'phone' => '934 111 222', 'company' => 'Pneus & Cia', 'nif' => '510555888', 'team_size' => '1-5', 'course_id' => $gestao, 'packs' => 1,
                'assigned_to' => $gestor?->id,
                'people' => [['name' => 'Teresa Nunes', 'email' => 'teresa@pneusecia.demo'], ['name' => 'Gonçalo Silva', 'email' => 'goncalo@pneusecia.demo'],
                    ['name' => 'Patrícia Reis', 'email' => 'patricia@pneusecia.demo'], ['name' => 'Óscar Martins', 'email' => 'oscar@pneusecia.demo']],
                'message' => 'Queremos o curso de gestão para 4 pessoas.',
            ], [
                [$gestor?->name ?? 'Gestor de cursos', 'Olá Teresa, segue a proposta: 1 pack de 10 lugares. Os dados de pagamento vão por email da contabilidade.'],
                [$gestor?->name ?? 'Gestor de cursos', 'Pagamento confirmado pela contabilidade. Vamos criar a equipa.'],
            ], 4);

            $this->request([
                'kind' => 'compra', 'type' => 'empresa', 'status' => 'aguardar_pagamento', 'name' => 'Fernando Sá', 'email' => 'fsa@arminho.demo',
                'company' => 'Auto Reparadora Minho', 'nif' => '511000999', 'team_size' => '6-20', 'course_id' => $baterias, 'packs' => 2,
                'assigned_to' => $gestor?->id, 'message' => 'Precisamos de 2 packs para 15 técnicos.',
            ], [[$gestor?->name ?? 'Gestor de cursos', 'Olá Fernando, enviámos a proposta para 2 packs. Aguardamos a confirmação do pagamento.']], 6);

            $aluno2 = User::where('email', 'aluno2@tacademy.pt')->first();
            if ($aluno2) {
                $this->request([
                    'kind' => 'compra', 'type' => 'particular', 'status' => 'pago', 'name' => $aluno2->name, 'email' => $aluno2->email,
                    'user_id' => $aluno2->id, 'course_id' => $baterias,
                    'message' => 'Compra a título pessoal (pagamento simulado enquanto o pagamento pela plataforma não está ativo).',
                ], [], 0);
            }

            $this->request([
                'kind' => 'compra', 'type' => 'empresa', 'status' => 'concluido', 'name' => 'Ana Ferreira', 'email' => 'ana.ferreira@gcporto.demo',
                'company' => 'Garagem Central do Porto', 'company_id' => $porto->id, 'course_id' => $gestao, 'packs' => 2,
                'assigned_to' => $gestor?->id, 'message' => 'Gestão de Oficina Moderna para 14 pessoas.',
            ], [[$gestor?->name ?? 'Gestor de cursos', 'Equipa criada e convites enviados. Bom curso!']], 20);
        });
    }

    private function team(string $name, string $nif, string $city, int $packs, array $courseIds, int $daysAgo): Company
    {
        $c = Company::create(['name' => $name, 'nif' => $nif, 'city' => $city, 'packs' => $packs]);
        $c->forceFill(['created_at' => now()->subDays($daysAgo)])->save();
        $c->courses()->attach($courseIds);

        return $c;
    }

    private function user(string $name, string $email, string $role, ?int $companyId, ?int $activeDaysAgo): User
    {
        $u = User::firstOrCreate(['email' => $email], [
            'name' => $name, 'password' => $this->password, 'role_id' => $this->roles[$role], 'email_verified_at' => now(),
        ]);
        $u->forceFill([
            'role_id' => $this->roles[$role],
            'company_id' => $companyId,
            'last_active_at' => $activeDaysAgo === null ? null : now()->subDays($activeDaysAgo),
        ])->save();

        return $u;
    }

    /** Membro com progresso por curso ([course_id => %]); cursos sem % ficam inscritos a 0. */
    private function member(Company $team, string $name, string $email, array $progress, ?int $activeDaysAgo, bool $leader = false): void
    {
        $u = $this->user($name, $email, $leader ? 'team_leader' : 'aluno', $team->id, $activeDaysAgo);
        foreach ($team->courses()->pluck('courses.id') as $courseId) {
            $this->enroll($u, $courseId, $team->id, $progress[$courseId] ?? 0, $activeDaysAgo ?? 0);
        }
    }

    private function enroll(User $u, int $courseId, ?int $companyId, int $percent, int $daysAgo): void
    {
        $lessons = Course::find($courseId)->lessons()->orderBy('modules.order_index')->orderBy('lessons.order_index')->pluck('lessons.id');
        $done = (int) round($lessons->count() * $percent / 100);
        Enrollment::updateOrCreate(['user_id' => $u->id, 'course_id' => $courseId], [
            'company_id' => $companyId, 'source' => 'manual', 'enrolled_at' => now()->subDays($daysAgo + 7),
            'status' => $done && $done === $lessons->count() ? 'completed' : 'active',
            'completed_at' => $done && $done === $lessons->count() ? now()->subDays($daysAgo) : null,
        ]);
        foreach ($lessons->take($done) as $i => $lessonId) {
            DB::table('lesson_progress')->updateOrInsert(['user_id' => $u->id, 'lesson_id' => $lessonId], [
                'status' => 'completed', 'progress_percent' => 100, 'completed_at' => now()->subDays($daysAgo),
                'updated_at' => now()->subDays($daysAgo)->subHours($done - $i),
            ]);
        }
        if ($done && $done === $lessons->count()) {
            DB::table('certificates')->insertOrIgnore([
                'ulid' => (string) Str::ulid(), 'user_id' => $u->id, 'course_id' => $courseId,
                'certificate_number' => 'TA-DEMO-'.strtoupper(Str::random(8)), 'status' => 'valid', 'issued_at' => now()->subDays($daysAgo),
            ]);
        }
    }

    /** Pedido com a mensagem inicial e (opcional) respostas da equipa de gestão. */
    private function request(array $data, array $replies, int $daysAgo): void
    {
        $r = ContactRequest::create($data);
        $r->forceFill(['created_at' => now()->subDays($daysAgo)->subHours(2), 'updated_at' => now()->subDays($daysAgo)])->save();
        $r->messages()->create(['author' => $data['name'], 'body' => $data['message'], 'user_id' => $data['user_id'] ?? null])
            ->forceFill(['created_at' => $r->created_at])->save();
        foreach ($replies as $i => [$author, $body]) {
            $r->messages()->create(['author' => $author, 'body' => $body, 'from_staff' => true])
                ->forceFill(['created_at' => $r->created_at->copy()->addHours(3 + $i * 20)])->save();
        }
    }
}
