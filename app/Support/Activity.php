<?php

namespace App\Support;

use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

/**
 * Registo de atividade (2026-11-15). Uma linha por ação que importa, com quem a fez,
 * o perfil nesse momento, sobre o quê, o que mudou e o IP. Só o admin consulta.
 *
 *     Activity::log('curso.publicado', $course);
 *     Activity::log('acesso.dado', $course, ['source' => 'compra'], related: $student);
 *
 * Regras (decididas com o utilizador):
 * - Guarda-se 12 meses; as linhas de compras e certificados ficam mais tempo, mas sem IP (prune).
 * - Quando uma conta é apagada de vez, deixa de aparecer pelo nome ("Conta apagada"), mas a ação fica.
 * - Registar nunca faz falhar a ação da pessoa: um erro aqui fica só no log do servidor.
 * - Seeders, tinker e comandos não registam (só pedidos HTTP e os testes).
 */
class Activity
{
    /** Meses que uma linha fica guardada. */
    public const KEEP_MONTHS = 12;

    /** Ações que ficam depois dos 12 meses, sem IP nem browser (prova de compras e certificados). */
    public const KEEP_LONGER = ['compra.', 'certificado.'];

    /** Grupos do registo (filtros da página), pela ordem em que aparecem. */
    public const GROUPS = [
        'contas' => 'Contas',
        'compras' => 'Compras e acessos',
        'cursos' => 'Cursos',
        'equipas' => 'Equipas',
        'administracao' => 'Administração',
        'aprendizagem' => 'Aprendizagem',
    ];

    /**
     * Cada ação: [grupo, frase (o que a pessoa fez), a vigiar?]. A frase completa-se na página
     * com o nome de quem é afetado e/ou com aquilo sobre que foi a ação.
     */
    public const ACTIONS = [
        'conta.entrou' => ['contas', 'entrou na plataforma'],
        'conta.saiu' => ['contas', 'saiu'],
        'conta.entrada_falhou' => ['contas', 'falhou a entrada', true],
        'conta.bloqueada_tentativas' => ['contas', 'ficou bloqueado por tentativas a mais', true],
        'conta.criada' => ['contas', 'criou conta'],
        'conta.email_mudado' => ['contas', 'mudou o email'],
        'conta.palavra_passe_mudada' => ['contas', 'mudou a palavra-passe'],
        'conta.palavra_passe_reposta' => ['contas', 'repôs a palavra-passe'],
        'conta.apagada' => ['contas', 'apagou a conta', true],
        'compra.pedida' => ['compras', 'pediu para comprar'],
        'compra.pago' => ['compras', 'marcou como pago'],
        'compra.concluido' => ['compras', 'autorizou a compra'],
        'compra.equipa_criada' => ['compras', 'criou a equipa a partir de'],
        'pedido.criado' => ['compras', 'fez o pedido'],
        'pedido.estado_mudado' => ['compras', 'mudou o estado de'],
        'acesso.dado' => ['compras', 'deu acesso a'],
        'acesso.retirado' => ['compras', 'retirou o acesso a', true],
        'acesso.passou_para_equipa' => ['compras', 'passou para a equipa o acesso de'],
        'curso.criado' => ['cursos', 'criou o curso'],
        'curso.publicado' => ['cursos', 'publicou o curso'],
        'curso.despublicado' => ['cursos', 'passou a rascunho o curso'],
        'curso.preco_mudado' => ['cursos', 'mudou o preço de'],
        'curso.formador_ia_bloqueado' => ['cursos', 'bloqueou o formador IA de', true],
        'curso.formador_ia_desbloqueado' => ['cursos', 'desbloqueou o formador IA de'],
        'curso.apagado' => ['cursos', 'apagou o curso', true],
        'equipa.criada' => ['equipas', 'criou a equipa'],
        'equipa.lugares_mudados' => ['equipas', 'mudou os lugares de'],
        'equipa.membro_entrou' => ['equipas', 'juntou à equipa'],
        'equipa.membro_saiu' => ['equipas', 'tirou da equipa'],
        'equipa.cursos_retirados' => ['equipas', 'retirou cursos da equipa', true],
        'equipa.curso_atribuido' => ['equipas', 'atribuiu o curso'],
        'equipa.prazo_mudado' => ['equipas', 'mudou o prazo de'],
        'equipa.lembrete_enviado' => ['equipas', 'enviou um lembrete a'],
        'pessoa.criada' => ['administracao', 'criou a conta de'],
        'pessoa.perfil_mudado' => ['administracao', 'mudou o perfil de', true],
        'pessoa.palavra_passe_mudada' => ['administracao', 'mudou a palavra-passe de', true],
        'pessoa.desativada' => ['administracao', 'desativou a conta de', true],
        'pessoa.reativada' => ['administracao', 'reativou a conta de'],
        'pessoa.apagada_de_vez' => ['administracao', 'apagou de vez uma conta', true],
        'permissoes.mudadas' => ['administracao', 'mudou as permissões de', true],
        'area.criada' => ['administracao', 'criou a área'],
        'area.mudada' => ['administracao', 'mudou o nome da área'],
        'area.apagada' => ['administracao', 'apagou a área'],
        'teste.feito' => ['aprendizagem', 'fez um teste de'],
        'curso.concluido' => ['aprendizagem', 'concluiu o curso'],
        'curso.presenca_confirmada' => ['aprendizagem', 'confirmou a presença de'],
        'curso.presenca_retirada' => ['aprendizagem', 'retirou a presença de'],
        'certificado.emitido' => ['aprendizagem', 'recebeu o certificado'],
        'registo.exportado' => ['administracao', 'exportou o registo de atividade'],
    ];

    /** Ações de um grupo (ou as que merecem atenção, com 'vigiar'), para filtrar na base de dados. */
    public static function actionsIn(string $group): array
    {
        return array_keys(array_filter(self::ACTIONS, fn ($a) => $group === 'vigiar' ? ($a[2] ?? false) : $a[0] === $group));
    }

    /** Desligado para seeders e comandos; os testes ligam-no. */
    public static function enabled(): bool
    {
        return ! app()->runningInConsole() || app()->runningUnitTests();
    }

    public static function log(string $action, ?Model $subject = null, array $properties = [], ?User $related = null, ?User $actor = null): ?ActivityLog
    {
        if (! self::enabled()) {
            return null;
        }

        try {
            $actor ??= auth()->user();
            $request = app()->bound('request') ? request() : null;

            $row = ActivityLog::create([
                'user_id' => $actor?->id,
                'user_name' => $actor?->name,
                'role' => $actor?->role?->name,
                'action' => $action,
                'subject_type' => $subject ? self::type($subject) : null,
                'subject_id' => $subject?->getKey(),
                'subject_label' => $subject ? Str::limit(self::label($subject), 197) : null,
                'related_user_id' => $related?->id,
                'properties' => $properties ?: null,
                'ip' => $request?->ip(),
                'user_agent' => $request ? Str::limit((string) $request->userAgent(), 252) : null,
            ]);
            self::pruneDaily();

            return $row;
        } catch (Throwable $e) {
            Log::warning('Registo de atividade falhou: '.$action, ['error' => $e->getMessage()]);

            return null;
        }
    }

    /** Nome curto do tipo de coisa (Course → curso), para filtrar no registo. */
    public static function type(Model $subject): string
    {
        return [
            \App\Models\Course::class => 'curso',
            \App\Models\User::class => 'pessoa',
            \App\Models\Company::class => 'equipa',
            \App\Models\ContactRequest::class => 'pedido',
            \App\Models\Category::class => 'area',
            \App\Models\Role::class => 'perfil',
            \App\Models\Certificate::class => 'certificado',
        ][$subject::class] ?? Str::snake(class_basename($subject));
    }

    /** O que se lê no registo: o título do curso, o nome da pessoa, o número do pedido… */
    public static function label(Model $subject): string
    {
        return (string) match (true) {
            $subject instanceof \App\Models\Course => $subject->title ?: __('Curso sem título'),
            $subject instanceof \App\Models\User => $subject->name,
            $subject instanceof \App\Models\Company => $subject->name,
            $subject instanceof \App\Models\ContactRequest => '#'.$subject->id.' · '.$subject->name,
            $subject instanceof \App\Models\Certificate => $subject->certificate_number,
            default => $subject->name ?? $subject->title ?? '#'.$subject->getKey(),
        };
    }

    /**
     * Apaga o que passou dos 12 meses; nas compras e certificados tira só o IP e o browser.
     * Corre uma vez por dia sozinho (ao registar) e pelo agendador (activity:prune).
     */
    public static function prune(): int
    {
        $limit = now()->subMonths(self::KEEP_MONTHS);
        $longer = function ($q) {
            foreach (self::KEEP_LONGER as $prefix) {
                $q->orWhere('action', 'like', $prefix.'%');
            }
        };

        ActivityLog::where('created_at', '<', $limit)->where($longer)
            ->where(fn ($q) => $q->whereNotNull('ip')->orWhereNotNull('user_agent'))
            ->update(['ip' => null, 'user_agent' => null]);

        return ActivityLog::where('created_at', '<', $limit)->whereNot($longer)->delete();
    }

    /** No Railway não há agendador: a limpeza corre no primeiro registo de cada dia. */
    private static function pruneDaily(): void
    {
        if (Cache::add('activity-log-pruned', true, now()->addDay())) {
            self::prune();
        }
    }

    /** Conta apagada de vez: as ações ficam, mas sem o nome, o IP nem o browser dessa pessoa. */
    public static function forget(User $user): void
    {
        ActivityLog::where('user_id', $user->id)->update(['user_name' => __('Conta apagada'), 'ip' => null, 'user_agent' => null]);
        ActivityLog::where('subject_type', 'pessoa')->where('subject_id', $user->id)->update(['subject_label' => __('Conta apagada')]);
    }
}
