<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Mensagem na conversa de um pedido (do cliente ou da equipa de gestão de cursos). */
class RequestMessage extends Model
{
    protected $fillable = ['contact_request_id', 'user_id', 'author', 'body', 'from_staff'];

    protected function casts(): array
    {
        return ['from_staff' => 'boolean'];
    }

    public function request(): BelongsTo
    {
        return $this->belongsTo(ContactRequest::class, 'contact_request_id');
    }
}
