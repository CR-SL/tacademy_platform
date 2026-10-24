<?php

namespace App\Providers;

use App\Models\User;
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
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Vite::prefetch(concurrency: 3);

        // O admin passa por cima de todas as Policies (super-utilizador).
        Gate::before(fn (User $user) => $user->isAdmin() ? true : null);

        // Em desenvolvimento/testes, todos os emails vão para uma só caixa (MAIL_ALWAYS_TO).
        // Só quando o mailer é criado (ao enviar): ligar já no arranque obrigava a ter a chave
        // do Resend em todo o lado e partia o `config:cache` do build sem ela.
        if ($to = config('tacademy.mail_always_to')) {
            $this->callAfterResolving('mail.manager', fn ($manager) => $manager->alwaysTo($to));
        }
    }
}
