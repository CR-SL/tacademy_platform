<?php

namespace App\Models;

use App\Models\Concerns\HasUlid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

class Enrollment extends Model
{
    use HasUlid;

    // A tabela enrollments usa enrolled_at/completed_at (sem created_at/updated_at padrão).
    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'course_id',
        'company_id',
        'source',
        'payment_id',
        'status',
        'enrolled_at',
        'completed_at',
        'due_at',
        'assigned_at',
        'assigned_by',
        'reminded_at',
        'attended_at',
    ];

    protected function casts(): array
    {
        return [
            'enrolled_at' => 'datetime',
            'completed_at' => 'datetime',
            'due_at' => 'date',
            'assigned_at' => 'datetime',
            'reminded_at' => 'datetime',
            'attended_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    /** Equipa que deu acesso ao curso (null = compra a título pessoal). */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /**
     * Prazo para concluir: o da empresa (ao atribuir a formação) ou, se não houver,
     * o do curso a contar da inscrição. null = sem prazo.
     */
    public function deadline(): ?Carbon
    {
        if ($this->due_at) {
            return $this->due_at->copy()->endOfDay();
        }
        $days = $this->course?->deadline_days;

        return $days && $this->enrolled_at ? $this->enrolled_at->copy()->addDays($days)->endOfDay() : null;
    }

    /** Quem definiu o prazo: 'empresa', 'curso' ou null. */
    public function deadlineSource(): ?string
    {
        return $this->due_at ? 'empresa' : ($this->course?->deadline_days ? 'curso' : null);
    }

    /** Prazo para mostrar: data, dias que faltam (negativo = passou) e quem o definiu. Null se não há ou já acabou. */
    public function deadlineInfo(bool $finished): ?array
    {
        $deadline = $this->deadline();
        if (! $deadline || $finished) {
            return null;
        }
        $days = (int) now()->startOfDay()->diffInDays($deadline->copy()->startOfDay(), false);

        return [
            'date' => $deadline->format('d/m/Y'),
            'days' => $days,
            'late' => $deadline->isPast(),
            'by' => $this->deadlineSource(),
        ];
    }
}
