<?php

namespace App\Http\Controllers;

use App\Models\ContactRequest;
use App\Models\Course;
use App\Services\TeamService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/**
 * Compra de um curso a título pessoal. O pagamento pela plataforma ainda não está decidido: por agora cria um pedido
 * "A aguardar pagamento"; o Gestor de Cursos combina o pagamento e autoriza com a referência do pagamento.
 */
class PurchaseController extends Controller
{
    public function store(Request $request, Course $course, TeamService $teams): RedirectResponse
    {
        abort_unless($course->status === 'published', 404);
        $user = $request->user();
        // Volta à página de onde veio (catálogo ou página do curso), com o aviso nos dois formatos
        $back = fn (string $msg) => redirect()->back(fallback: route('catalog', ['curso' => $course->slug]))->with('purchase', $msg)->with('status', $msg);

        // Quem tem o acesso expirado pode comprar outra vez (ao autorizar, a validade conta de novo)
        $enrollment = $user->enrollments()->where('course_id', $course->id)->first();
        if ($enrollment && ! $enrollment->isExpired()) {
            return $back(__('Já tens acesso a este curso.'));
        }
        $pending = ContactRequest::where('user_id', $user->id)->where('course_id', $course->id)
            ->where('kind', 'compra')->whereIn('status', ContactRequest::OPEN)->exists();
        if ($pending) {
            return $back(__('A tua compra já está registada e aguarda autorização.'));
        }

        $amount = $course->is_free ? 0 : (float) $course->price; // o preço deste momento (a receita não muda se o preço mudar)
        $r = ContactRequest::create([
            'kind' => 'compra',
            'type' => 'particular',
            // Ainda não há pagamento pela plataforma: o gestor combina o pagamento e só autoriza com a referência
            'status' => $amount > 0 ? 'aguardar_pagamento' : 'pago',
            'name' => $user->name,
            'email' => $user->email,
            'user_id' => $user->id,
            'course_id' => $course->id,
            'amount' => $amount,
            'message' => $amount > 0
                ? __('Compra a título pessoal. A aguardar pagamento: a equipa da T.Academy envia os dados de pagamento por email.')
                : __('Inscrição a título pessoal num curso gratuito.'),
        ]);
        $r->messages()->create(['user_id' => $user->id, 'author' => $user->name, 'body' => $r->message]);
        $teams->notifyStaff($r->load('course'));

        return $back($amount > 0
            ? __('Compra registada. Vais receber por email os dados de pagamento; ficas com acesso assim que o pagamento for confirmado.')
            : __('Compra registada. Ficas com acesso assim que o gestor de cursos a autorizar.'));
    }
}
