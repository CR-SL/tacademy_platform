<?php

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * Pedidos à API do Tavus (https://docs.tavus.io). Só corre no servidor: a chave nunca vai para o browser.
 * Erros do Tavus viram RuntimeException com uma mensagem curta; a chave nunca entra nos logs.
 */
class TavusClient
{
    public function configured(): bool
    {
        return filled(config('services.tavus.api_key')) && filled(config('services.tavus.pal_id'));
    }

    /**
     * Cria uma conversa. Devolve conversation_id, conversation_url e meeting_token (sala privada).
     *
     * @return array{conversation_id: string, conversation_url: string, meeting_token: ?string}
     */
    public function createConversation(array $payload): array
    {
        $data = $this->post('/v2/conversations', $payload);
        if (empty($data['conversation_id']) || empty($data['conversation_url'])) {
            throw new RuntimeException('Resposta do Tavus sem conversation_id.');
        }

        return [
            'conversation_id' => $data['conversation_id'],
            'conversation_url' => $data['conversation_url'],
            'meeting_token' => $data['meeting_token'] ?? null,
        ];
    }

    /** Termina uma conversa (não apaga os dados no Tavus). */
    public function endConversation(string $conversationId): void
    {
        $this->post('/v2/conversations/'.rawurlencode($conversationId).'/end');
    }

    private function post(string $path, array $payload = []): array
    {
        try {
            $res = Http::baseUrl(rtrim(config('services.tavus.base_url'), '/'))
                ->withHeaders(['x-api-key' => (string) config('services.tavus.api_key')])
                ->acceptJson()
                ->timeout(25)
                ->post($path, $payload);
        } catch (ConnectionException $e) {
            Log::warning('Tavus sem resposta', ['path' => $path, 'error' => $e->getMessage()]);
            throw new RuntimeException('O Tavus não respondeu.', 0, $e);
        }

        if ($res->failed()) {
            Log::warning('Tavus recusou o pedido', ['path' => $path, 'status' => $res->status(), 'body' => mb_substr($res->body(), 0, 500)]);
            throw new RuntimeException('O Tavus recusou o pedido ('.$res->status().').');
        }

        return $res->json() ?? [];
    }
}
