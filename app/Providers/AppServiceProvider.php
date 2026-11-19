<?php

namespace App\Providers;

use App\Models\User;
use App\Support\ActivityRecorder;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\URL;
use Illuminate\Validation\Rules\Password;
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

        // Formulário de contactos (auditoria, ponto 16): além do limite por minuto, um limite diário por ligação
        // e por email, para não servir para encher a caixa dos gestores
        \Illuminate\Support\Facades\RateLimiter::for('contacts', fn (\Illuminate\Http\Request $r) => [
            \Illuminate\Cache\RateLimiting\Limit::perMinute(5)->by('contacts-min|'.$r->ip()),
            \Illuminate\Cache\RateLimiting\Limit::perDay(20)->by('contacts-day|'.$r->ip()),
            \Illuminate\Cache\RateLimiting\Limit::perDay(5)->by('contacts-email|'.mb_strtolower((string) $r->input('email'))),
        ]);

        // Em produção, todos os links (emails incluídos) usam o APP_URL, nunca o domínio que vem no pedido
        if ($this->app->isProduction() && ($root = config('app.url'))) {
            URL::forceRootUrl($root);
            if (str_starts_with($root, 'https://')) {
                URL::forceScheme('https');
            }
        }

        // Palavras-passe novas: pelo menos 10 carateres. Em produção recusa também as que aparecem em fugas de
        // dados conhecidas (Have I Been Pwned: só sai o início do hash; se o serviço falhar, aceita).
        Password::defaults(fn () => $this->app->isProduction()
            ? Password::min(10)->uncompromised()
            : Password::min(10));

        // O admin passa por cima de todas as Policies (super-utilizador).
        Gate::before(fn (User $user) => $user->isAdmin() ? true : null);

        // Registo de atividade: o que se faz na plataforma, com o IP (só o admin consulta)
        ActivityRecorder::register();

        // Uma Gate por permissão (ex.: middleware can:pedidos), lida do perfil da pessoa
        foreach (\App\Support\Permissions::keys() as $permission) {
            Gate::define($permission, fn (User $user) => $user->canDo($permission));
        }

        // Confirmar o email e criar palavra-passe nova: o mesmo aspeto dos outros emails da plataforma
        // (a língua é a da conta, porque o User tem HasLocalePreference)
        \Illuminate\Auth\Notifications\VerifyEmail::toMailUsing(function ($user, string $url) {
            $name = \Illuminate\Support\Str::before(trim((string) $user->name), ' ');

            return \App\Mail\PlatformMail::notification(__('Confirma o teu email'), [
                'preheader' => __('Falta só um passo para começares a aprender na T.Academy.'),
                'heading' => $name ? __('Olá :name, confirma o teu email', ['name' => $name]) : __('Confirma o teu email'),
                'lines' => [__('A tua conta na T.Academy está criada. Falta só um passo: confirma que este email é teu.')],
                'actionText' => __('Confirmar o email'),
                'actionUrl' => $url,
                'steps' => [
                    __('Confirma o email com o botão acima.'),
                    __('Explora o catálogo e escolhe o teu primeiro curso.'),
                    __('Aprende ao teu ritmo e recebe o certificado T.Academy no fim.'),
                ],
                'note' => __('O link funciona durante :count minutos. Se não criaste uma conta, ignora este email.', ['count' => config('auth.verification.expire', 60)]),
            ]);
        });

        \Illuminate\Auth\Notifications\ResetPassword::toMailUsing(function ($user, string $token) {
            $email = $user->getEmailForPasswordReset();

            return \App\Mail\PlatformMail::notification(__('Criar uma palavra-passe nova'), [
                'preheader' => __('O link para criares uma palavra-passe nova para a tua conta.'),
                'heading' => __('Cria uma palavra-passe nova'),
                'lines' => [
                    __('Recebemos um pedido para criar uma palavra-passe nova para a conta :email.', ['email' => $email]),
                    __('Escolhe uma com pelo menos 10 carateres.'),
                ],
                'actionText' => __('Criar palavra-passe nova'),
                'actionUrl' => url(route('password.reset', ['token' => $token, 'email' => $email], false)),
                'note' => __('Este link funciona durante :count minutos. Se não foste tu que pediste, ignora este email: a tua palavra-passe não muda.', ['count' => config('auth.passwords.'.config('auth.defaults.passwords').'.expire', 60)]),
            ]);
        });

        // Em desenvolvimento/testes, todos os emails vão para uma só caixa (MAIL_ALWAYS_TO).
        // Só quando o mailer é criado (ao enviar): ligar já no arranque obrigava a ter a chave
        // do Resend em todo o lado e partia o `config:cache` do build sem ela.
        if ($to = config('tacademy.mail_always_to')) {
            $this->callAfterResolving('mail.manager', fn ($manager) => $manager->alwaysTo($to));
        }
    }
}
