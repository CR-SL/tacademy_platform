<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * Email simples da plataforma (convites, respostas a pedidos, avisos aos gestores de cursos).
 * Um só modelo visual em resources/views/emails/message.blade.php.
 */
class PlatformMail extends Mailable
{
    use Queueable, SerializesModels;

    /** @param string[] $lines */
    public function __construct(
        public string $subjectLine,
        public string $heading,
        public array $lines = [],
        public ?string $quote = null,
        public ?string $actionText = null,
        public ?string $actionUrl = null,
        // Opcionais: etiqueta de estado (ex.: "Compra confirmada"), cartão do curso, resumo e próximos passos
        public ?string $badge = null,
        public ?array $card = null,
        public ?array $summary = null,
        public ?string $summaryTitle = null,
        public array $steps = [],
    ) {}

    /** Cartão do curso para o email: capa, área e nível, título e números verdadeiros do curso. */
    public static function courseCard(\App\Models\Course $course): array
    {
        $course->loadMissing('category')->loadCount(['modules', 'lessons']);
        $image = $course->thumbnail_url ?: (config('tacademy.course_images')[$course->slug] ?? null);
        $minutes = (int) $course->duration_minutes;
        $levels = ['iniciante' => __('Iniciante'), 'intermedio' => __('Intermédio'), 'avancado' => __('Avançado')];

        return [
            'image' => $image ? url($image) : null,
            'label' => collect([$course->category?->name, $levels[$course->level] ?? null])->filter()->implode(' · '),
            'title' => $course->title,
            'facts' => array_values(array_filter([
                $course->modules_count ? trans_choice('{1} 1 módulo|[2,*] :count módulos', $course->modules_count) : null,
                $course->lessons_count ? trans_choice('{1} 1 aula|[2,*] :count aulas', $course->lessons_count) : null,
                $minutes ? ($minutes >= 60 ? intdiv($minutes, 60).' h'.($minutes % 60 ? ' '.($minutes % 60).' min' : '') : $minutes.' min') : null,
                $course->certificate_enabled ? __('Certificado') : null,
            ])),
        ];
    }

    /**
     * O mesmo aspeto para as notificações do Laravel (confirmar o email, criar palavra-passe nova):
     * devolve a MailMessage com a vista dos emails da plataforma.
     */
    public static function notification(string $subject, array $data): \Illuminate\Notifications\Messages\MailMessage
    {
        return (new \Illuminate\Notifications\Messages\MailMessage)
            ->subject($subject)
            ->view('emails.message', $data + [
                'subject' => $subject, 'heading' => $subject, 'lines' => [], 'quote' => null,
                'actionText' => null, 'actionUrl' => null, 'badge' => null, 'card' => null,
                'summary' => null, 'summaryTitle' => null, 'steps' => [], 'note' => null,
            ]);
    }

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->subjectLine);
    }

    public function content(): Content
    {
        return new Content(view: 'emails.message', with: ['subject' => $this->subjectLine]);
    }

    /**
     * Monta e envia um email na língua de quem o recebe: a da conta, ou português para quem não tem conta
     * (respostas a contactos, por exemplo). A língua de quem carregou no botão volta no fim.
     */
    public static function inLocaleOf(\App\Models\User|string|null $who, callable $send): mixed
    {
        $locale = $who instanceof \App\Models\User ? $who->preferredLocale() : ($who ?: config('app.locale', 'pt'));
        $previous = app()->getLocale();
        \App\Http\Middleware\SetLocale::apply($locale);
        try {
            return $send();
        } finally {
            \App\Http\Middleware\SetLocale::apply($previous);
        }
    }

    /**
     * Envia sem interromper o pedido se o email falhar (ex.: SMTP ainda por configurar):
     * o erro fica no log e a ação na plataforma continua.
     */
    public static function deliver(string|array $to, self $mail): bool
    {
        try {
            Mail::to($to)->send($mail);

            return true;
        } catch (Throwable $e) {
            Log::warning('Email não enviado: '.$mail->subjectLine, ['to' => $to, 'error' => $e->getMessage()]);

            return false;
        }
    }
}
