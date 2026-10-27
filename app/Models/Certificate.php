<?php

namespace App\Models;

use App\Models\Concerns\HasUlid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Certificado de conclusão de um curso (para já só o registo e o número; o PDF vem depois). */
class Certificate extends Model
{
    use HasUlid;

    public $timestamps = false;

    protected $fillable = ['user_id', 'course_id', 'certificate_number', 'status', 'issued_at', 'expires_at', 'revoked_at', 'pdf_url'];

    protected function casts(): array
    {
        return ['issued_at' => 'datetime', 'expires_at' => 'datetime', 'revoked_at' => 'datetime'];
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
