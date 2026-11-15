<?php

namespace App\Models;

use App\Models\Concerns\HasUlid;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
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
        'personal',
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
            'personal' => 'boolean',
            'enrolled_at' => 'datetime',
            'completed_at' => 'datetime',
            'due_at' => 'date',
            'assigned_at' => 'datetime',
            'reminded_at' => 'datetime',
            'attended_at' => 'datetime',
        ];
    }

    /** Uma inscrição criada sem empresa é pessoal (compra ou acesso individual): não se perde ao sair de uma equipa. */
    protected static function booted(): void
    {
        static::creating(function (Enrollment $e) {
            if ($e->company_id === null && $e->personal === null) {
                $e->personal = true;
            }
        });
    }

    /**
     * Tira as inscrições da query à equipa. A pessoa nunca é apagada e mantém o curso quando:
     * - o tem por conta própria (compra), ou
     * - já o concluiu ou tem o certificado (fica com o curso e o certificado).
     * Essas deixam só de contar para a empresa e perdem o prazo que ela deu. As outras (curso da equipa por concluir)
     * saem: a pessoa deixa de ter acesso, mas o progresso, as tentativas e os certificados ficam guardados
     * (se voltar a ter o curso, retoma onde estava). Devolve os course_id a que a pessoa perdeu o acesso.
     */
    public static function releaseFromCompany(Builder $query): Collection
    {
        $rows = $query->get();
        $certified = Certificate::whereIn('user_id', $rows->pluck('user_id')->unique())->whereIn('course_id', $rows->pluck('course_id')->unique())
            ->where('status', 'valid')->get(['user_id', 'course_id'])
            ->map(fn ($c) => $c->user_id.'-'.$c->course_id)->flip();
        $keeps = fn (Enrollment $e) => $e->personal || $e->status === 'completed' || $certified->has($e->user_id.'-'.$e->course_id);
        $lost = $rows->reject($keeps);
        $kept = $rows->filter($keeps);
        if ($kept->isNotEmpty()) {
            static::whereIn('id', $kept->modelKeys())->update([
                'company_id' => null, 'due_at' => null, 'assigned_at' => null, 'assigned_by' => null, 'reminded_at' => null,
            ]);
        }
        if ($lost->isNotEmpty()) {
            static::whereIn('id', $lost->modelKeys())->delete();
        }

        return $lost->pluck('course_id')->values();
    }

    /** A validade do acesso (access_months do curso, contada desde a inscrição) já passou. */
    public function isExpired(): bool
    {
        $months = $this->course?->access_months;

        return $months && $this->enrolled_at && $this->enrolled_at->copy()->addMonths($months)->isPast();
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
