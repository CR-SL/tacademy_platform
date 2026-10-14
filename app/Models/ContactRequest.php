<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ContactRequest extends Model
{
    public const TYPES = [
        'empresa' => 'Empresa',
        'particular' => 'Particular',
    ];

    public const TEAM_SIZES = [
        '1-5' => '1 – 5',
        '6-20' => '6 – 20',
        '21-50' => '21 – 50',
        '50+' => 'Mais de 50',
    ];

    public const STATUSES = [
        'novo' => 'Novo',
        'em_contacto' => 'Em contacto',
        'fechado' => 'Fechado',
    ];

    protected $fillable = [
        'type',
        'name',
        'email',
        'phone',
        'company',
        'team_size',
        'course_id',
        'message',
        'consent_at',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'consent_at' => 'datetime',
        ];
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }
}
