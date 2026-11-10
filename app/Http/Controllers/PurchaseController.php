<?php

namespace App\Http\Controllers;

use App\Models\ContactRequest;
use App\Models\Course;
use App\Services\TeamService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/**
 * Compra de um curso a título pessoal. O pagamento pela plataforma ainda não está decidido:
 * por agora a "compra" é simulada e cria um pedido já no estado Pago, que o Gestor de Cursos autoriza.
 */
class PurchaseController extends Controller
{
    public function store(Request $request, Course $course, TeamService $teams): RedirectResponse
    {
        abort_unless($course->status === 'published', 404);
        $user = $request->user();
        // Volta à página de onde veio (catálogo ou página do curso), com o aviso nos dois formatos
        $back = fn (string $msg) => redirect()->back(fallback: route('catalog', ['curso' => $course->slug]))->with('purchase', $msg)->with('status', $msg);

        if ($user->enrollments()->where('course_id', $course->id)->exists()) {
            return $back(__('Já tens acesso a este curso.'));
        }
        $pending = ContactRequest::where('user_id', $user->id)->where('course_id', $course->id)
            ->where('kind', 'compra')->whereIn('status', ContactRequest::OPEN)->exists();
        if ($pending) {
            return $back(__('A tua compra já está registada e aguarda autorização.'));
        }

        $r = ContactRequest::create([
            'kind' => 'compra',
            'type' => 'particular',
            'status' => 'pago',
            'name' => $user->name,
            'email' => $user->email,
            'user_id' => $user->id,
            'course_id' => $course->id,
            'message' => __('Compra a título pessoal (pagamento simulado enquanto o pagamento pela plataforma não está ativo).'),
        ]);
        $r->messages()->create(['user_id' => $user->id, 'author' => $user->name, 'body' => $r->message]);
        $teams->notifyStaff($r->load('course'));

        return $back(__('Compra registada. Ficas com acesso assim que o gestor de cursos a autorizar.'));
    }
}
