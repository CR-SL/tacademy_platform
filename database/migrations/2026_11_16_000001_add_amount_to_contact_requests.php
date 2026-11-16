<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Preço pago numa compra pessoal (2026-11-16). A receita da Administração usava o preço atual do curso: quando o
 * formador mudava o preço, as vendas antigas mudavam de valor. As compras que já existem ficam com o preço de hoje.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('contact_requests', function (Blueprint $table) {
            $table->decimal('amount', 8, 2)->nullable()->after('course_id');
        });
        DB::table('contact_requests')->where('kind', 'compra')->where('type', 'particular')->whereNotNull('course_id')
            ->orderBy('id')->each(function ($r) {
                $course = DB::table('courses')->where('id', $r->course_id)->first(['price', 'is_free']);
                if ($course) {
                    DB::table('contact_requests')->where('id', $r->id)->update(['amount' => $course->is_free ? 0 : $course->price]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('contact_requests', fn (Blueprint $table) => $table->dropColumn('amount'));
    }
};
