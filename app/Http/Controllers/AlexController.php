<?php

namespace App\Http\Controllers;

use App\Models\AlexConversation;
use App\Models\ContactRequest;
use App\Services\AlexLimitReached;
use App\Services\AlexService;
use App\Services\TeamService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;
use RuntimeException;

/** Conversas com o Alex (Tavus): começar, terminar, comprar créditos e receber os avisos do Tavus. */
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
            return response()->json(['message' => __('Não tens conversas disponíveis. Compra créditos para continuar a falar com o Alex.'), 'left' => 0, 'credits' => 0], 429);
        } catch (RuntimeException) {
            return response()->json(['message' => __('O Alex não está disponível agora. Tenta daqui a pouco.')], 503);
        }
    }

    /**
     * Compra de créditos de avatar (1 crédito = 1 conversa). Como a compra de cursos: o pagamento ainda é
     * simulado, fica um pedido "Pago" e o gestor de cursos autoriza em Pedidos; os créditos entram aí.
     */
    public function buy(Request $request, TeamService $teams): RedirectResponse
    {
        $packs = config('services.tavus.packs', []);
        $credits = (int) $request->validate(['credits' => ['required', 'integer', Rule::in(array_keys($packs))]])['credits'];
        $user = $request->user();

        if (ContactRequest::where('user_id', $user->id)->where('kind', 'creditos')->whereIn('status', ContactRequest::OPEN)->exists()) {
            return back()->with('status', __('Já tens uma compra de créditos à espera de autorização.'));
        }

        $price = number_format((float) $packs[$credits], 2, ',', ' ');
        $r = ContactRequest::create([
            'kind' => 'creditos',
            'type' => 'particular',
            'status' => 'pago',
            'credits' => $credits,
            'name' => $user->name,
            'email' => $user->email,
            'user_id' => $user->id,
            'message' => __('Compra de :n créditos de avatar (:price €). Pagamento simulado enquanto o pagamento pela plataforma não está ativo.', ['n' => $credits, 'price' => $price]),
        ]);
        $r->messages()->create(['user_id' => $user->id, 'author' => $user->name, 'body' => $r->message]);
        $teams->notifyStaff($r);

        return back()->with('status', __('Compra registada. Os créditos ficam disponíveis assim que o gestor de cursos a autorizar.'));
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
