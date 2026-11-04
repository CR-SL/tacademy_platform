<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Quem está inscrito abre qualquer aula, pela ordem que quiser: o "unlock_window" deixa de existir.
 * Corrige também a aula "Como funciona este curso" do curso de demonstração, que ainda explicava o desbloqueio
 * e o botão "Marcar como concluída" (só se o texto antigo ainda lá estiver, para não apagar edições do formador).
 */
return new class extends Migration
{
    private const OLD = 'As aulas abrem por ordem: conclui cada uma para desbloquear a seguinte.'."\n\n".'Nas aulas de vídeo, quando terminares, carrega em «Marcar como concluída».';

    private const NEW = 'Podes abrir as aulas pela ordem que quiseres, mas recomendamos seguir o programa.'."\n\n".'As aulas de vídeo ficam concluídas sozinhas quando vires 90% do vídeo.';

    public function up(): void
    {
        Schema::table('courses', function (Blueprint $table) {
            $table->dropColumn('unlock_window');
        });

        DB::table('lessons')->where('title', 'Como funciona este curso')->where('body', 'like', '%Marcar como concluída%')
            ->get(['id', 'body'])
            ->each(fn ($l) => DB::table('lessons')->where('id', $l->id)->update(['body' => str_replace(self::OLD, self::NEW, $l->body)]));
    }

    public function down(): void
    {
        Schema::table('courses', function (Blueprint $table) {
            $table->unsignedTinyInteger('unlock_window')->default(5)->after('access_months');
        });
    }
};
