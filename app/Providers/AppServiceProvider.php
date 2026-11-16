<?php

namespace App\Providers;

use App\Models\User;
use App\Support\ActivityRecorder;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Uma só instância por pedido: guardam contas já feitas nesse pedido (ex.: o relatório da equipa,
        // pedido pelos números da navegação, pelos Pendentes e pela caixa Equipa)
        $this->app->scoped(\App\Services\TeamService::class);
        $this->app->scoped(\App\Services\StudentArea::class);
        $this->app->scoped(\App\Services\AdminStats::class);
        $this->app->scoped(\App\Services\Tasks::class);
        // No fim de cada pedido esquecem-se (nos testes e em servidores que tratam vários pedidos no mesmo processo)
        $this->app['events']->listen(\Illuminate\Foundation\Http\Events\RequestHandled::class, fn () => $this->app->forgetScopedInstances());
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Vite::prefetch(concurrency: 3);

        // O admin passa por cima de todas as Policies (super-utilizador).
        Gate::before(fn (User $user) => $user->isAdmin() ? true : null);

        // Registo de atividade: o que se faz na plataforma, com o IP (só o admin consulta)
        ActivityRecorder::register();

        // Uma Gate por permissão (ex.: middleware can:pedidos), lida do perfil da pessoa
        foreach (\App\Support\Permissions::keys() as $permission) {
            Gate::define($permission, fn (User $user) => $user->canDo($permission));
        }

        // Em desenvolvimento/testes, todos os emails vão para uma só caixa (MAIL_ALWAYS_TO).
        // Só quando o mailer é criado (ao enviar): ligar já no arranque obrigava a ter a chave
        // do Resend em todo o lado e partia o `config:cache` do build sem ela.
        if ($to = config('tacademy.mail_always_to')) {
            $this->callAfterResolving('mail.manager', fn ($manager) => $manager->alwaysTo($to));
        }
    }
}
