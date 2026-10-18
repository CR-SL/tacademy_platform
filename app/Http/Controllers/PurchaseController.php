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
        $back = redirect()->to(route('courses', ['curso' => $course->slug]));

        if ($user->enrollments()->where('course_id', $course->id)->exists()) {
            return $back->with('purchase', 'Já tens acesso a este curso.');
        }
        $pending = ContactRequest::where('user_id', $user->id)->where('course_id', $course->id)
            ->where('kind', 'compra')->whereIn('status', ContactRequest::OPEN)->exists();
        if ($pending) {
            return $back->with('purchase', 'A tua compra já está registada e aguarda autorização.');
        }

        $r = ContactRequest::create([
            'kind' => 'compra',
            'type' => 'particular',
            'status' => 'pago',
            'name' => $user->name,
            'email' => $user->email,
            'user_id' => $user->id,
            'course_id' => $course->id,
            'message' => 'Compra a título pessoal (pagamento simulado enquanto o pagamento pela plataforma não está ativo).',
        ]);
        $r->messages()->create(['user_id' => $user->id, 'author' => $user->name, 'body' => $r->message]);
        $teams->notifyStaff($r->load('course'));

        return $back->with('purchase', 'Compra registada! Vais receber acesso assim que a equipa de gestão de cursos a autorizar.');
    }
}
