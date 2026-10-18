<?php

namespace App\Models;

use App\Models\Concerns\HasUlid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Empresa cliente. Para já, uma empresa = uma equipa: os seus utilizadores são os membros
 * (um deles com o perfil team_leader) e todos têm acesso aos cursos da equipa.
 */
class Company extends Model
{
    use HasUlid, SoftDeletes;

    /** Os cursos são vendidos a empresas em packs de 10 lugares. */
    public const SEATS_PER_PACK = 10;

    protected $fillable = [
        'name',
        'nif',
        'address',
        'postal_code',
        'city',
        'packs',
    ];

    protected function casts(): array
    {
        return ['packs' => 'integer'];
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    /** Cursos da equipa (todos os membros têm acesso a todos). */
    public function courses(): BelongsToMany
    {
        return $this->belongsToMany(Course::class)->withTimestamps();
    }

    /** Inscrições feitas através da equipa (as únicas que o team leader vê). */
    public function enrollments(): HasMany
    {
        return $this->hasMany(Enrollment::class);
    }

    public function seats(): int
    {
        return $this->packs * self::SEATS_PER_PACK;
    }
}
