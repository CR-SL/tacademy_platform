<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Password;

/**
 * Links de convite e fim das outras sessões (auditoria, pontos 12 e 13).
 */
class InviteLink
{
    /** Link para definir a palavra-passe de uma conta convidada: vale 3 dias (broker "invites"). */
    public static function url(User $user): string
    {
        $token = Password::broker('invites')->createToken($user);

        return url(route('password.reset', ['token' => $token, 'email' => $user->email, 'convite' => 1], false));
    }

    /**
     * Termina as outras sessões da pessoa (todas, se $keep for null) e invalida o "manter a sessão iniciada".
     * Corre ao mudar ou repor a palavra-passe: quem tinha a palavra-passe antiga deixa de estar dentro.
     */
    public static function endOtherSessions(User $user, ?string $keep = null): void
    {
        // A tabela das sessões existe sempre (migração); só tem linhas com SESSION_DRIVER=database, como em produção
        DB::table(config('session.table') ?: 'sessions')->where('user_id', $user->id)
            ->when($keep, fn ($q) => $q->where('id', '!=', $keep))->delete();
        $user->forceFill(['remember_token' => \Illuminate\Support\Str::random(60)])->save();
    }
}
