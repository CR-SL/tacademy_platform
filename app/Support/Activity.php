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
