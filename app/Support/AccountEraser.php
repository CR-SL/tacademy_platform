<?php

namespace App\Support;

use App\Models\AlexConversation;
use App\Models\Certificate;
use App\Models\ContactRequest;
use App\Models\CourseMessage;
use App\Models\CourseView;
use App\Models\Enrollment;
use App\Models\LessonNote;
use App\Models\LessonProgress;
use App\Models\QuizAttempt;
use App\Models\RequestMessage;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * "Apagar a minha conta" (RGPD, auditoria ponto 11). Diferente de "desativar" (gestão), que se pode desfazer.
 *
 * Apaga: progresso, testes, notas, mensagens com o formador, conversas com o Alex (e transcrições), inscrições,
 * certificados, avaliações, notificações, sessões e o pedido de nova palavra-passe.
 * Fica, sem dados pessoais:
 *  - a linha da conta, com o nome "Conta apagada" e um email que não existe (o email verdadeiro fica livre para
 *    uma conta nova). Não se pode reativar;
 *  - os pagamentos e os pedidos de compra (de empresa, ou pessoais com valor): a lei obriga a guardar os registos de faturação.
 *    Os outros pedidos (contactos sem compra) ficam sem nome, email, telefone e mensagem;
 *  - o registo de atividade, sem nome, IP nem browser (Activity::forget).
 */
class AccountEraser
{
    public const ERASED_NAME = 'Conta apagada';

    public static function erase(User $user): void
    {
        DB::transaction(function () use ($user) {
            $id = $user->id;
            $email = $user->email;

            LessonProgress::where('user_id', $id)->delete();
            QuizAttempt::where('user_id', $id)->delete();
            LessonNote::where('user_id', $id)->delete();
            CourseMessage::where('student_id', $id)->orWhere('sender_id', $id)->delete();
            AlexConversation::where('user_id', $id)->delete();
            Enrollment::where('user_id', $id)->delete();
            Certificate::where('user_id', $id)->delete();
            CourseView::where('user_id', $id)->update(['user_id' => null]);
            foreach (['user_badges', 'reviews', 'notifications'] as $table) {
                DB::table($table)->where('user_id', $id)->delete();
            }
            DB::table('sessions')->where('user_id', $id)->delete();
            DB::table('password_reset_tokens')->where('email', $email)->delete();

            // Pedidos de compra (com valor): ficam para a faturação. Os outros perdem os dados de contacto.
            $requests = ContactRequest::where(fn ($q) => $q->where('user_id', $id)->orWhere('email', $email));
            (clone $requests)->where('kind', '!=', 'compra')->where(fn ($q) => $q->whereNull('amount')->orWhere('amount', '<=', 0))->update([
                'name' => __(self::ERASED_NAME), 'email' => self::erasedEmail($user), 'phone' => null, 'message' => '',
            ]);
            RequestMessage::where('user_id', $id)->update(['author' => __(self::ERASED_NAME)]);

            Activity::forget($user);

            $user->forceFill([
                'name' => __(self::ERASED_NAME),
                'email' => self::erasedEmail($user),
                'phone' => null,
                'avatar_url' => null,
                'password' => Hash::make(Str::random(64)),
                'remember_token' => null,
                'company_id' => null,
                'panel_layouts' => null,
                'alex_credits' => 0,
                'email_reminders' => false,
                'erased_at' => now(),
            ])->save();
            if (! $user->trashed()) {
                $user->delete();
            }
        });
    }

    /** Email que não existe e é único (domínio .invalid, reservado): deixa o verdadeiro livre para uma conta nova. */
    private static function erasedEmail(User $user): string
    {
        return 'apagada-'.$user->ulid.'@conta-apagada.invalid';
    }
}
