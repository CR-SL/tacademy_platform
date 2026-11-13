<?php

namespace App\Http\Controllers;

use App\Models\AlexConversation;
use App\Services\AlexLimitReached;
use App\Services\AlexService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;
use RuntimeException;

/** Conversas com o Alex (Tavus): começar, terminar e receber os avisos do Tavus. */
class AlexController extends Controller
{
    public function __construct(private AlexService $alex) {}

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'place' => ['required', Rule::in(AlexService::PLACES)],
            'lesson' => ['required_if:place,aula', 'nullable', 'string', 'max:30'],
        ]);

        try {
            return response()->json($this->alex->start($request->user(), $data['place'], $data['lesson'] ?? null), 201);
        } catch (AuthorizationException) {
            return response()->json(['message' => __('O Alex não está disponível aqui.')], 403);
        } catch (AlexLimitReached $e) {
            return response()->json(['message' => __('Já usaste as :n conversas de hoje com o Alex. Volta amanhã.', ['n' => $e->perDay]), 'left' => 0], 429);
        } catch (RuntimeException) {
            return response()->json(['message' => __('O Alex não está disponível agora. Tenta daqui a pouco.')], 503);
        }
    }

    public function end(Request $request, AlexConversation $conversation): JsonResponse
    {
        abort_unless($conversation->user_id === $request->user()->id, 403);
        $this->alex->end($conversation);

        return response()->json(['ok' => true, 'left' => $this->alex->leftToday($request->user())]);
    }

    /** Avisos do Tavus (fim da sala, transcrição), assinados com o segredo da conversa. */
    public function webhook(Request $request): Response
    {
        $body = $request->getContent();
        abort_unless($this->alex->validSignature($body, $request->header('X-Tavus-Signature')), 401);
        $this->alex->handleCallback(json_decode($body, true) ?: []);

        return response()->noContent();
    }
}
