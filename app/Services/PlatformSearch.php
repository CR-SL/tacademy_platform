<?php

namespace App\Services;

use App\Models\Category;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\User;
use Illuminate\Support\Str;

/**
 * Pesquisa do topo da plataforma (lupa). Desde 2026-11-24 procura só em categorias e cursos, a pedido do utilizador:
 * os cursos do catálogo (publicados) e os cursos em que a pessoa está inscrita.
 */
class PlatformSearch
{
    /** Resultados por grupo (o resto conta-se em "total"). */
    public const PER_GROUP = 6;

    /** @return array{groups: array} */
    public function search(?User $user, string $query): array
    {
        $terms = $this->terms($query);
        if (! $terms) {
            return ['groups' => []];
        }

        $mine = $user
            ? Enrollment::where('user_id', $user->id)->pluck('course_id')->flip()
            : collect();
        $courses = Course::with('category:id,name,slug')
            ->where(fn ($q) => $q->where('status', 'published')->orWhereIn('id', $mine->keys()))
            ->orderBy('title')
            ->get(['id', 'slug', 'title', 'category_id', 'level', 'price', 'is_free', 'status']);

        $levels = ['iniciante' => __('Iniciante'), 'intermedio' => __('Intermédio'), 'avancado' => __('Avançado')];

        // Categorias com cursos no catálogo
        $published = $courses->where('status', 'published');
        $categories = Category::whereIn('id', $published->pluck('category_id')->filter()->unique())->orderBy('name')->get(['id', 'name', 'slug'])
            ->filter(fn ($c) => $this->matches($terms, $c->name))->values();

        $found = $courses->filter(fn ($c) => $this->matches($terms, $c->title, (string) $c->category?->name))->values();

        return ['groups' => collect([
            [
                'key' => 'categories', 'title' => __('Categorias'), 'total' => $categories->count(),
                'items' => $categories->take(self::PER_GROUP)->map(function ($c) use ($published) {
                    $n = $published->where('category_id', $c->id)->count();

                    return ['title' => $c->name, 'meta' => trans_choice('{1} 1 curso|[2,*] :count cursos', $n), 'url' => '/plataforma/cursos?area='.$c->slug];
                })->values()->all(),
            ],
            [
                'key' => 'courses', 'title' => __('Cursos'), 'total' => $found->count(),
                'items' => $found->take(self::PER_GROUP)->map(fn ($c) => [
                    'title' => $c->title,
                    'meta' => collect([
                        $c->category?->name,
                        $levels[$c->level] ?? null,
                        $mine->has($c->id) ? __('Inscrito') : ($c->is_free ? __('Gratuito') : number_format((float) $c->price, 2, ',', ' ').' €'),
                    ])->filter()->implode(' · '),
                    // Quem tem o curso abre-o em "Os meus cursos"; os outros, no catálogo
                    'url' => $mine->has($c->id) ? '/plataforma/meus-cursos?curso='.$c->slug : '/plataforma/cursos?curso='.$c->slug,
                ])->values()->all(),
            ],
        ])->filter(fn ($g) => $g['total'] > 0)->values()->all()];
    }

    /** Palavras da pesquisa, sem acentos nem maiúsculas ("Mecânica  auto" → ['mecanica', 'auto']). */
    private function terms(string $query): array
    {
        return collect(preg_split('/\s+/', $this->fold($query)))->filter(fn ($w) => mb_strlen($w) >= 2 || ctype_digit($w))->take(6)->values()->all();
    }

    private function fold(string $text): string
    {
        return Str::lower(Str::ascii($text));
    }

    /** Todas as palavras têm de aparecer em algum dos textos. */
    private function matches(array $terms, string ...$texts): bool
    {
        $hay = $this->fold(implode(' ', $texts));
        foreach ($terms as $t) {
            if (! str_contains($hay, $t)) {
                return false;
            }
        }

        return true;
    }
}
