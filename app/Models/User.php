<?php

namespace App\Models;

use App\Models\Concerns\HasUlid;
use Database\Factories\UserFactory;
use Illuminate\Contracts\Translation\HasLocalePreference;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable implements HasLocalePreference
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, HasUlid, Notifiable, SoftDeletes;

    protected $fillable = [
        'company_id',
        'role_id',
        'name',
        'email',
        'password',
        'phone',
        'avatar_url',
        'theme',
        'email_reminders',
        'level',
        'streak_days',
        'last_active_at',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'panel_layouts',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_active_at' => 'datetime',
            'password' => 'hashed',
            'streak_days' => 'integer',
            'panel_layouts' => 'array',
            'email_reminders' => 'boolean',
        ];
    }

    // Relações

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function enrollments(): HasMany
    {
        return $this->hasMany(Enrollment::class);
    }

    // Papéis / autorização

    public function hasRole(string $name): bool
    {
        return $this->role?->name === $name;
    }

    /** Língua dos emails e notificações enviados a esta pessoa (a da plataforma, ou o português). */
    public function preferredLocale(): string
    {
        return $this->locale ?: config('app.locale', 'pt');
    }

    public function isAdmin(): bool
    {
        return $this->hasRole('admin');
    }

    /** Pode fazer isto? (Administração › Permissões; o admin pode sempre) */
    public function canDo(string $permission): bool
    {
        return $this->isAdmin() || in_array($permission, $this->role?->permissionKeys() ?? [], true);
    }

    /** Quem trata pedidos (sino dos pedidos, pré-visualizar cursos). */
    public function isCourseStaff(): bool
    {
        return $this->canDo('pedidos');
    }

    public function isTeamLeader(): bool
    {
        return $this->hasRole('team_leader') && $this->company_id !== null;
    }

    /**
     * Navegação "só o seu trabalho" (opção D, 2026-11-09): formador, gestor de cursos e admin
     * não têm a parte do aluno na barra. Aluno e team leader ficam como estavam.
     */
    public function worksOnly(): bool
    {
        return in_array($this->role?->name, ['formador', 'gestor_cursos', 'admin'], true);
    }

    /** Primeira página depois de entrar (e do logótipo): o Início do aluno, ou o trabalho de cada perfil. */
    public function homeUrl(): string
    {
        if (! $this->worksOnly()) {
            return '/dashboard';
        }

        return match (true) {
            $this->canDo('estatisticas') || $this->canDo('pessoas') => '/administracao',
            $this->canDo('cursos.criar') && ! $this->canDo('cursos.todos') => '/formador',
            $this->canDo('pedidos') => '/gestao/pedidos',
            $this->canDo('equipas') => '/gestao/equipas',
            $this->canDo('cursos.todos') => '/formador/cursos',
            default => '/dashboard',
        };
    }
}
