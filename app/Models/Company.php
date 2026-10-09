<?php

namespace App\Models;

use App\Models\Concerns\HasUlid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Company extends Model
{
    use HasUlid, SoftDeletes;

    protected $fillable = [
        'name',
        'nif',
        'address',
        'postal_code',
        'city',
    ];

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }
}
