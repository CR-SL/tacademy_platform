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
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->subjectLine);
    }

    public function content(): Content
    {
        return new Content(view: 'emails.message', with: ['subject' => $this->subjectLine]);
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
