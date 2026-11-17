<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Pedido: nasce no formulário de contactos, num pedido de alteração do team leader
 * ou numa compra a título pessoal. É gerido pelos Gestores de Cursos em "Pedidos".
 */
class ContactRequest extends Model
{
    public const TYPES = [
        'empresa' => 'Empresa',
        'particular' => 'Particular',
    ];

    public const KINDS = [
        'esclarecimento' => 'Esclarecimento',
        'compra' => 'Compra de curso',
        'creditos' => 'Compra de créditos de avatar',
        'alteracao' => 'Alteração de equipa',
    ];

    public const TEAM_SIZES = [
        '1-5' => '1 – 5',
        '6-20' => '6 – 20',
        '21-50' => '21 – 50',
        '50+' => 'Mais de 50',
    ];

    /** Percurso de um pedido de compra; os outros tipos usam só Novo / Em esclarecimento / Concluído / Cancelado. */
    public const STATUSES = [
        'novo' => 'Novo',
        'em_esclarecimento' => 'Em esclarecimento',
        'aguardar_pagamento' => 'A aguardar pagamento',
        'pago' => 'Pago',
        'equipa_criada' => 'Equipa criada',
        'concluido' => 'Concluído',
        'cancelado' => 'Cancelado',
    ];

    /** Rótulos para mostrar (as constantes ficam em português; traduz-se aqui, na língua de quem vê). */
    public static function labels(array $map): array
    {
        return array_map(fn ($label) => __($label), $map);
    }

    public const OPEN = ['novo', 'em_esclarecimento', 'aguardar_pagamento', 'pago', 'equipa_criada'];

    /** Estados em que uma compra pessoal ou de créditos ainda se pode autorizar. */
    public const AUTHORIZABLE = ['aguardar_pagamento', 'pago'];

    public const CHANGE_TYPES = [
        'adicionar' => 'Adicionar pessoa',
        'retirar' => 'Retirar pessoa',
        'lugares' => 'Mais lugares (pack de 10)',
        'curso' => 'Novo curso',
        'outro' => 'Outro',
    ];

    protected $fillable = [
        'kind',
        'credits',
        'amount', // preço pago (compra pessoal), para a receita não mudar quando o preço do curso muda
        'payment_ref', // referência do pagamento, escrita pelo gestor ao autorizar
        'type',
        'name',
        'email',
        'phone',
        'company',
        'nif',
        'team_size',
        'course_id',
        'packs',
        'people',
        'change_type',
        'company_id',
        'user_id',
        'assigned_to',
        'message',
        'consent_at',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'consent_at' => 'datetime',
            'people' => 'array',
            'packs' => 'integer',
        ];
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    /** Equipa a que o pedido diz respeito (alterações) ou que foi criada a partir dele. */
    public function team(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /** Compra pessoal ou de créditos que envolve dinheiro: só se autoriza com a referência do pagamento. */
    public function needsPayment(): bool
    {
        // Pedidos antigos não têm o preço guardado (amount vazio): conta como pago
        return $this->kind === 'creditos'
            || ($this->kind === 'compra' && $this->type === 'particular' && ($this->amount === null || (float) $this->amount > 0));
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(RequestMessage::class)->oldest();
    }
}
