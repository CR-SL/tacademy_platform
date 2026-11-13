<?php

namespace App\Services;

use App\Models\AlexConversation;
use App\Models\ContactRequest;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Lesson;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * O Alex (avatar do Tavus) pela API.
 * - Aparece no Início, nas Avaliações e nas aulas dos cursos com o Alex, para quem tem esses cursos.
 * - Cada conversa é uma sala privada no Tavus, com tempo máximo, e fica registada (limite diário por aluno).
 * - O Alex sabe quem é o aluno e onde está; a memória entre conversas fica no Tavus, por aluno.
 * A identidade, o papel e a base de conhecimento do Alex vivem no PAL, no Tavus.
 */
class AlexService
{
    public const PLACES = ['inicio', 'avaliacoes', 'aula'];

    public function __construct(
        private TavusClient $tavus,
        private LearningService $learning,
        private StudentArea $area,
    ) {}

    // ---------------------------------------------------------------- onde aparece

    /**
     * Dados para as páginas (prop partilhada `alex`):
     * - com `place`: nesta página o aluno pode falar com o Alex;
     * - com `place` null: o aluno tem um curso com o Alex, mas fala com ele noutras páginas;
     * - null: sem Alex (sem curso com formador IA, ou numa aula de um curso sem o Alex).
     */
    public function forRequest(Request $request): ?array
    {
        $user = $request->user();
        if (! $user || ! $this->tavus->configured()) {
            return null;
        }

        $place = match ($request->route()?->getName()) {
            'dashboard' => 'inicio',
            'student.assessments' => 'avaliacoes',
            'learn.lesson' => 'aula',
            default => null,
        };
        if (! $place) {
            return $this->hasAccess($user) ? ['place' => null] : $this->buyOffer($user);
        }

        $lesson = null;
        if ($place === 'aula') {
            $course = $request->route('course');
            $lesson = $request->route('lesson');
            if (! $course instanceof Course || ! $lesson instanceof Lesson || ! $this->canUseInCourse($user, $course)) {
                return null;
            }
        } elseif (! $this->hasAccess($user)) {
            return $this->buyOffer($user);
        }

        return [
            'place' => $place,
            'lesson' => $lesson?->ulid,
            'left' => $this->leftToday($user),
            'credits' => (int) $user->alex_credits,
            'free' => $this->hasFreeTalks($user),
            'perDay' => $this->perDay(),
            'minutes' => $this->minutes(),
            ...$this->shop($user),
        ];
    }

    /** Aluno sem curso com o avatar e sem créditos: a caixa do Alex mostra a compra de créditos. */
    private function buyOffer(User $user): ?array
    {
        return $user->learns() ? ['place' => null, 'buy' => true, 'minutes' => $this->minutes(), ...$this->shop($user)] : null;
    }

    /** Pacotes de créditos à venda e se já há uma compra à espera do gestor. */
    private function shop(User $user): array
    {
        return [
            'packs' => collect(config('services.tavus.packs', []))->map(fn ($price, $credits) => ['credits' => (int) $credits, 'price' => (float) $price])->values(),
            'pending' => ContactRequest::where('user_id', $user->id)->where('kind', 'creditos')->whereIn('status', ContactRequest::OPEN)->value('credits'),
        ];
    }

    /** Cursos com o Alex: ligado no editor do curso (formador IA). */
    public function isAlexCourse(Course $course): bool
    {
        return (bool) $course->alex_enabled;
    }

    /**
     * Pode falar com o Alex no Início e nas Avaliações: tem um curso com o avatar (conversas grátis por dia)
     * ou créditos por gastar. O admin pode sempre, para testar.
     */
    public function hasAccess(User $user): bool
    {
        return $this->hasFreeTalks($user) || $user->alex_credits > 0;
    }

    /** Conversas grátis por dia: quem tem um curso com o avatar (e o admin). */
    public function hasFreeTalks(User $user): bool
    {
        return $user->isAdmin() || $this->alexCourses($user)->isNotEmpty();
    }

    public function canUseInCourse(User $user, Course $course): bool
    {
        return $this->isAlexCourse($course)
            && in_array($this->learning->access($user, $course)['mode'], ['enrolled', 'preview'], true);
    }

    /** Cursos do aluno com o Alex, do mais recente para o mais antigo. @return Collection<int, Course> */
    private function alexCourses(User $user): Collection
    {
        return Enrollment::with('course')->where('user_id', $user->id)->orderByDesc('enrolled_at')->get()
            ->map(fn ($e) => $e->course)
            ->filter(fn ($c) => $c && $this->isAlexCourse($c) && $this->learning->access($user, $c)['mode'] === 'enrolled')
            ->values();
    }

    public function perDay(): int
    {
        return max(1, (int) config('services.tavus.per_day', 3));
    }

    public function minutes(): int
    {
        return max(1, (int) config('services.tavus.minutes', 15));
    }

    /** Conversas grátis que ainda há hoje (0 para quem não tem um curso com o avatar). */
    public function leftToday(User $user): int
    {
        if (! $this->hasFreeTalks($user)) {
            return 0;
        }
        $used = AlexConversation::where('user_id', $user->id)
            ->where('created_at', '>=', now()->startOfDay())
            ->where('status', '!=', 'failed')
            ->where('paid_credit', false)
            ->count();

        return max(0, $this->perDay() - $used);
    }

    // ---------------------------------------------------------------- conversas

    /**
     * Começa uma conversa. Devolve o que a página precisa para entrar na sala.
     *
     * @throws AuthorizationException quando o aluno não pode falar com o Alex aqui
     * @throws AlexLimitReached quando já usou as conversas grátis de hoje e não tem créditos
     * @throws RuntimeException quando o Tavus falha
     */
    public function start(User $user, string $place, ?string $lessonUlid): array
    {
        $lesson = null;
        $course = null;
        if ($place === 'aula') {
            $lesson = Lesson::with('module.course')->where('ulid', $lessonUlid)->first();
            $course = $lesson?->module?->course;
            if (! $course || ! $this->canUseInCourse($user, $course)) {
                throw new AuthorizationException;
            }
        } elseif (! in_array($place, self::PLACES, true) || ! $this->hasAccess($user)) {
            throw new AuthorizationException;
        } else {
            // No Início e nas Avaliações fala o Alex do curso mais recente do aluno (ou o Alex geral)
            $course = $this->alexCourses($user)->first();
        }

        // Uma conversa de cada vez: a que estiver aberta termina antes de começar outra
        AlexConversation::where('user_id', $user->id)->whereIn('status', ['starting', 'active'])->get()
            ->each(fn ($c) => $this->end($c, 'nova conversa'));

        // Primeiro as conversas grátis do dia; depois 1 crédito por conversa
        $paid = $this->leftToday($user) <= 0;
        if ($paid && User::whereKey($user->id)->where('alex_credits', '>', 0)->decrement('alex_credits') === 0) {
            throw new AlexLimitReached($this->perDay());
        }

        $conversation = AlexConversation::create([
            'user_id' => $user->id,
            'course_id' => $course?->id,
            'lesson_id' => $lesson?->id,
            'place' => $place,
            'paid_credit' => $paid,
            'status' => 'starting',
        ]);

        try {
            $room = $this->tavus->createConversation($this->payload($user, $place, $course, $lesson));
        } catch (RuntimeException $e) {
            $conversation->update(['status' => 'failed', 'end_reason' => Str::limit($e->getMessage(), 110)]);
            if ($paid) {
                User::whereKey($user->id)->increment('alex_credits'); // as falhas do Tavus não gastam créditos
            }
            throw $e;
        }

        $conversation->update(['tavus_id' => $room['conversation_id'], 'status' => 'active']);

        return [
            'id' => $conversation->ulid,
            'url' => $room['conversation_url'],
            'token' => $room['meeting_token'],
            'endsAt' => $conversation->created_at->copy()->addMinutes($this->minutes())->toIso8601String(),
            'left' => $this->leftToday($user),
            'credits' => (int) $user->fresh()->alex_credits,
        ];
    }

    /** Termina a conversa no Tavus (se ainda estiver aberta) e regista o fim. */
    public function end(AlexConversation $conversation, string $reason = 'terminada pelo aluno'): void
    {
        if (! in_array($conversation->status, ['starting', 'active'], true)) {
            return;
        }
        if ($conversation->tavus_id) {
            try {
                $this->tavus->endConversation($conversation->tavus_id);
            } catch (RuntimeException) {
                // O Tavus fecha-a sozinho (tempo máximo ou saída do aluno); o registo fica fechado na mesma
            }
        }
        $conversation->update(['status' => 'ended', 'end_reason' => $reason, 'ended_at' => now()]);
    }

    // ---------------------------------------------------------------- avisos do Tavus (webhook)

    /** Segredo dos avisos do Tavus: derivado da APP_KEY, não precisa de outra variável. */
    public function callbackSecret(): string
    {
        return hash_hmac('sha256', 'tavus-callback', (string) config('app.key'));
    }

    public function validSignature(string $body, ?string $signature): bool
    {
        return is_string($signature) && hash_equals(hash_hmac('sha256', $body, $this->callbackSecret()), strtolower(trim($signature)));
    }

    /** Fim da sala e transcrição, enviados pelo Tavus. */
    public function handleCallback(array $event): void
    {
        $conversation = AlexConversation::where('tavus_id', $event['conversation_id'] ?? '')->first();
        if (! $conversation) {
            return;
        }
        $props = $event['properties'] ?? [];

        match ($event['event_type'] ?? null) {
            'system.shutdown' => $conversation->update([
                'status' => $conversation->status === 'failed' ? 'failed' : 'ended',
                'end_reason' => $conversation->end_reason ?? Str::limit((string) ($props['shutdown_reason'] ?? 'fim'), 110),
                'ended_at' => $conversation->ended_at ?? now(),
            ]),
            'application.transcription_ready' => $conversation->update(['transcript' => $props['transcript'] ?? null]),
            default => null,
        };
    }

    // ---------------------------------------------------------------- o que o Alex fica a saber

    private function payload(User $user, string $place, ?Course $course, ?Lesson $lesson): array
    {
        // O Alex do curso, se o curso tiver um; senão o Alex geral (config). O rosto acompanha o PAL escolhido.
        $ownPal = $course?->alex_pal_id;
        $face = $course?->alex_face_id ?: ($ownPal ? null : config('services.tavus.face_id'));
        $payload = [
            'pal_id' => $ownPal ?: config('services.tavus.pal_id'),
            'conversation_name' => Str::limit('T.Academy · '.$user->name.' · '.$place, 100, ''),
            'conversational_context' => Str::limit($this->context($user, $place, $course, $lesson), 3500),
            'custom_greeting' => $this->greeting($user, $place, $lesson),
            // A memória do Alex segue o aluno de conversa em conversa (uma etiqueta por aluno, no Tavus)
            'participant_tags' => ['tacademy-'.$user->ulid],
            // Sala privada: só entra quem recebe o token desta conversa
            'require_auth' => true,
            'properties' => [
                'max_call_duration' => $this->minutes() * 60,
                'participant_left_timeout' => 30,
                'participant_absent_timeout' => 120,
                'languages' => ['pt'],
            ],
        ];
        if ($face) {
            $payload['face_id'] = $face;
        }
        // Os avisos do Tavus só chegam a um endereço público (produção)
        $callback = url('/webhooks/tavus');
        if (str_starts_with($callback, 'https://')) {
            $payload['callback_url'] = $callback;
            $payload['callback_secret'] = $this->callbackSecret();
        }

        return $payload;
    }

    private function greeting(User $user, string $place, ?Lesson $lesson): string
    {
        $first = Str::before(trim($user->name), ' ') ?: $user->name;

        return match ($place) {
            'avaliacoes' => "Olá {$first}! Sou o Alex. Queres rever algum teste comigo?",
            'aula' => "Olá {$first}! Estás na aula {$lesson?->title}. Tens alguma dúvida?",
            default => "Olá {$first}! Sou o Alex. Em que te posso ajudar hoje?",
        };
    }

    private function context(User $user, string $place, ?Course $course, ?Lesson $lesson): string
    {
        $lines = ["O aluno chama-se {$user->name}. Fala em português de Portugal e trata-o por tu. Está na plataforma de cursos T.Academy."];

        if ($course && $place !== 'aula') {
            $lines[] = "És o formador IA do curso \"{$course->title}\".";
        }

        if ($place === 'aula' && $course && $lesson) {
            $lessons = $this->learning->lessons($course);
            $done = $this->learning->completedIds($user, $lessons)->count();
            $pct = $lessons->count() ? (int) floor($done / $lessons->count() * 100) : 0;
            $lines[] = "Está a estudar o curso \"{$course->title}\", na aula \"{$lesson->title}\" do módulo \"{$lesson->module?->title}\". Já concluiu {$done} de {$lessons->count()} aulas ({$pct}%).";

            return implode("\n", $lines);
        }

        $courses = collect($this->area->courses($user))
            ->map(fn ($c) => "{$c['title']} ({$c['pct']}%, {$c['done']} de {$c['total']} aulas)")
            ->implode('; ');
        $lines[] = $courses ? "Os cursos dele: {$courses}." : 'Ainda não está inscrito em nenhum curso.';

        $pending = collect($this->area->pending($user))->take(5)->map(fn ($p) => "{$p['title']} ({$p['course']})")->implode('; ');
        if ($pending) {
            $lines[] = "Testes por fazer: {$pending}.";
        }

        if ($place === 'avaliacoes') {
            $lines[] = 'Está na página das Avaliações, a ver os resultados dos testes.';
            $results = collect($this->area->results($user, 5))->map(function ($r) {
                $review = collect($r['review'])->take(3)->implode(' | ');

                return "{$r['title']} ({$r['course']}): {$r['score']}%, ".($r['passed'] ? 'passou' : 'não passou')
                    .", tentativa {$r['attempt']} de {$r['attempts']}".($review ? "; perguntas a rever: {$review}" : '');
            })->implode("\n");
            $lines[] = $results ? "Últimos testes:\n{$results}" : 'Ainda não fez nenhum teste.';
        } else {
            $lines[] = 'Está no Início da plataforma.';
        }

        return implode("\n", $lines);
    }
}
