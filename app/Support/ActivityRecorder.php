<?php

namespace App\Support;

use App\Models\Category;
use App\Models\Certificate;
use App\Models\Company;
use App\Models\ContactRequest;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\QuizAttempt;
use App\Models\Role;
use App\Models\User;
use App\Support\Permissions;
use Illuminate\Auth\Events\Failed;
use Illuminate\Auth\Events\Lockout;
use Illuminate\Auth\Events\Login;
use Illuminate\Auth\Events\Logout;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Support\Facades\Event;

/**
 * Liga o registo de atividade às ações da plataforma (chamado no AppServiceProvider).
 * Ouve os eventos da entrada e as mudanças dos modelos; o que é feito em massa (sem eventos)
 * regista-se onde acontece (LearningService, TeamService, Staff\TeamController).
 *
 * Só ações que importam para segurança, suporte e dinheiro. Na aprendizagem, só os marcos:
 * acesso, curso concluído, teste feito, presença e certificado (não cada aula aberta).
 */
class ActivityRecorder
{
    /** Só guarda o que é mesmo um email (auditoria, ponto 23): uma palavra-passe escrita no campo errado não fica no registo. */
    private static function emailOnly(mixed $value): ?string
    {
        return is_string($value) && filter_var($value, FILTER_VALIDATE_EMAIL) ? mb_strtolower($value) : null;
    }

    public static function register(): void
    {
        // Contas: entrar, falhar, sair, bloqueio por tentativas, palavra-passe reposta
        Event::listen(Login::class, fn (Login $e) => Activity::log('conta.entrou', $e->user, ['lembrar' => $e->remember ?: null], actor: $e->user));
        Event::listen(Logout::class, fn (Logout $e) => $e->user && Activity::log('conta.saiu', $e->user, actor: $e->user));
        Event::listen(Failed::class, fn (Failed $e) => Activity::log('conta.entrada_falhou', $e->user, ['email' => self::emailOnly($e->credentials['email'] ?? null)], actor: null));
        Event::listen(Lockout::class, fn (Lockout $e) => Activity::log('conta.bloqueada_tentativas', null, ['email' => self::emailOnly($e->request->input('email'))]));
        Event::listen(PasswordReset::class, fn (PasswordReset $e) => Activity::log('conta.palavra_passe_reposta', $e->user, actor: $e->user));

        // Pessoas e contas
        User::created(function (User $u) {
            $actor = auth()->user();
            Activity::log($actor ? 'pessoa.criada' : 'conta.criada', $u, ['perfil' => $u->role?->name], actor: $actor ?? $u);
        });
        User::updated(function (User $u) {
            $self = auth()->id() === $u->id;
            if ($u->wasChanged('email')) {
                Activity::log('conta.email_mudado', $u, ['antes' => $u->getOriginal('email'), 'depois' => $u->email]);
            }
            if ($u->wasChanged('password') && auth()->check()) {
                Activity::log($self ? 'conta.palavra_passe_mudada' : 'pessoa.palavra_passe_mudada', $u);
            }
            if ($u->wasChanged('role_id')) {
                Activity::log('pessoa.perfil_mudado', $u, [
                    'antes' => Role::find($u->getOriginal('role_id'))?->name,
                    'depois' => $u->role()->value('name'),
                ]);
            }
            if ($u->wasChanged('company_id')) {
                $before = $u->getOriginal('company_id');
                if ($before) Activity::log('equipa.membro_saiu', Company::find($before), related: $u);
                if ($u->company_id) Activity::log('equipa.membro_entrou', Company::find($u->company_id), related: $u);
            }
        });
        User::deleted(function (User $u) {
            if ($u->isForceDeleting()) {
                Activity::log('pessoa.apagada_de_vez', null, ['id' => $u->id]);
            } else {
                Activity::log(auth()->id() === $u->id ? 'conta.apagada' : 'pessoa.desativada', $u);
            }
        });
        User::restored(fn (User $u) => Activity::log('pessoa.reativada', $u));
        // Antes de a conta desaparecer (a ligação ao user_id fica a null): tira o nome e o IP das linhas dela
        User::forceDeleting(fn (User $u) => Activity::forget($u));
        Role::updated(function (Role $r) {
            if (! $r->wasChanged('permissions')) return;
            // Sem permissões guardadas, o perfil usava as iniciais
            $before = (array) ($r->getOriginal('permissions') ?? Permissions::DEFAULTS[$r->name] ?? []);
            $after = (array) $r->permissions;
            Activity::log('permissoes.mudadas', $r, [
                'acrescentadas' => array_values(array_diff($after, $before)) ?: null,
                'retiradas' => array_values(array_diff($before, $after)) ?: null,
            ]);
        });

        // Cursos: criar, publicar/despublicar, preço, formador IA bloqueado, apagar
        Course::created(fn (Course $c) => Activity::log('curso.criado', $c));
        Course::updated(function (Course $c) {
            if ($c->wasChanged('status')) {
                Activity::log($c->status === 'published' ? 'curso.publicado' : 'curso.despublicado', $c);
            }
            if ($c->wasChanged('price') && (float) $c->getOriginal('price') !== (float) $c->price) {
                Activity::log('curso.preco_mudado', $c, ['antes' => (float) $c->getOriginal('price'), 'depois' => (float) $c->price]);
            }
            if ($c->wasChanged('alex_blocked')) {
                Activity::log($c->alex_blocked ? 'curso.formador_ia_bloqueado' : 'curso.formador_ia_desbloqueado', $c);
            }
        });
        Course::deleted(fn (Course $c) => Activity::log('curso.apagado', $c));

        // Áreas do catálogo
        Category::created(fn (Category $a) => Activity::log('area.criada', $a));
        Category::updated(fn (Category $a) => $a->wasChanged('name') && Activity::log('area.mudada', $a, ['antes' => $a->getOriginal('name'), 'depois' => $a->name]));
        Category::deleted(fn (Category $a) => Activity::log('area.apagada', $a));

        // Compras e pedidos
        ContactRequest::created(fn (ContactRequest $r) => Activity::log($r->kind === 'compra' ? 'compra.pedida' : 'pedido.criado', $r, array_filter([
            'tipo' => $r->kind, 'curso' => $r->course?->title, 'empresa' => $r->company,
        ])));
        ContactRequest::updated(function (ContactRequest $r) {
            if (! $r->wasChanged('status')) return;
            $action = $r->kind === 'compra' && in_array($r->status, ['pago', 'concluido', 'equipa_criada'], true)
                ? 'compra.'.$r->status : 'pedido.estado_mudado';
            Activity::log($action, $r, ['antes' => $r->getOriginal('status'), 'depois' => $r->status]);
        });

        // Equipas
        Company::created(fn (Company $c) => Activity::log('equipa.criada', $c, ['packs' => $c->packs]));
        Company::updated(fn (Company $c) => $c->wasChanged('packs') && Activity::log('equipa.lugares_mudados', $c, ['antes' => $c->getOriginal('packs'), 'depois' => $c->packs]));

        // Acessos e marcos da aprendizagem
        Enrollment::created(fn (Enrollment $e) => Activity::log('acesso.dado', $e->course, array_filter([
            'origem' => $e->source, 'equipa' => $e->company?->name,
        ]), related: $e->user));
        Enrollment::deleted(fn (Enrollment $e) => Activity::log('acesso.retirado', $e->course, related: $e->user));
        Enrollment::updated(function (Enrollment $e) {
            if ($e->wasChanged('company_id') && $e->company_id) {
                Activity::log('acesso.passou_para_equipa', $e->course, ['equipa' => $e->company?->name], related: $e->user);
            }
            if ($e->wasChanged('assigned_at') && $e->assigned_at) {
                Activity::log('equipa.curso_atribuido', $e->course, ['prazo' => $e->due_at?->format('Y-m-d')], related: $e->user);
            } elseif ($e->wasChanged('due_at')) {
                Activity::log('equipa.prazo_mudado', $e->course, ['antes' => $e->getOriginal('due_at') ? (string) $e->getOriginal('due_at') : null, 'depois' => $e->due_at?->format('Y-m-d')], related: $e->user);
            }
            if ($e->wasChanged('reminded_at') && $e->reminded_at) {
                Activity::log('equipa.lembrete_enviado', $e->course, related: $e->user);
            }
            if ($e->wasChanged('attended_at')) {
                Activity::log($e->attended_at ? 'curso.presenca_confirmada' : 'curso.presenca_retirada', $e->course, related: $e->user);
            }
        });
        QuizAttempt::created(fn (QuizAttempt $a) => Activity::log('teste.feito', $a->quiz?->lesson?->module?->course, [
            'teste' => $a->quiz?->title ?: $a->quiz?->lesson?->title, 'nota' => $a->score, 'passou' => (bool) $a->passed,
        ], related: User::find($a->user_id)));
        Certificate::created(fn (Certificate $c) => Activity::log('certificado.emitido', $c, ['curso' => $c->course?->title], related: $c->user));
    }
}
