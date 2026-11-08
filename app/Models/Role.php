<?php

namespace App\Models;

use App\Support\Permissions;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Role extends Model
{
    // A tabela roles só tem created_at (sem updated_at).
    public $timestamps = false;

    protected $fillable = ['name', 'permissions'];

    protected function casts(): array
    {
        return ['permissions' => 'array'];
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    /** O que este perfil pode fazer: o guardado na Administração ou, se nunca mudou, o inicial. */
    public function permissionKeys(): array
    {
        if ($this->name === 'admin') {
            return Permissions::keys();
        }

        return array_values(array_intersect($this->permissions ?? Permissions::DEFAULTS[$this->name] ?? [], Permissions::keys()));
    }
}
