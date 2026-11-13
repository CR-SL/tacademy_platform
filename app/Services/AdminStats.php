<?php

namespace App\Services;

use App\Models\ContactRequest;
use App\Models\Course;
use App\Models\CourseView;
use App\Models\Enrollment;
use App\Models\LessonProgress;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Números da Administração, todos da base de dados:
 * - vendas: compras a título pessoal pagas ou autorizadas (o pagamento ainda é simulado) e compras de empresas;
 * - cliques: aberturas dos cursos no catálogo (course_views);
 * - conclusão: inscrições concluídas, a meio (com alguma aula começada) e por começar.
 */
class AdminStats
{
    public const DAYS = 30;

    private const PAID_PERSONAL = ['pago', 'concluido'];

    private const PAID_COMPANY = ['pago', 'equipa_criada', 'concluido'];

    private function since(): Carbon
    {
        return now()->subDays(self::DAYS)->startOfDay();
    }

    private function personalSales(?int $courseId = null, ?Carbon $since = null)
    {
        return ContactRequest::query()
            ->where('contact_requests.kind', 'compra')->where('contact_requests.type', 'particular')
            ->whereIn('contact_requests.status', self::PAID_PERSONAL)
            ->whereNotNull('contact_requests.course_id')
            ->when($courseId, fn ($q) => $q->where('contact_requests.course_id', $courseId))
            ->when($since, fn ($q) => $q->where('contact_requests.created_at', '>=', $since));
    }

    /** Vendas e receita por curso, nos últimos 30 dias. */
    public function salesByCourse(): Collection
    {
        return $this->personalSales(null, $this->since())
            ->join('courses', 'courses.id', '=', 'contact_requests.course_id')
            ->groupBy('contact_requests.course_id', 'courses.title', 'courses.price')
            ->selectRaw('contact_requests.course_id, courses.title, courses.price, count(*) as n')
            ->get()
            ->map(fn ($r) => ['id' => $r->course_id, 'title' => $r->title, 'sales' => (int) $r->n, 'revenue' => round($r->n * (float) $r->price, 2)])
            ->sortByDesc('revenue')->values();
    }

    /** Compras por mês (6 meses). */
    public function salesByMonth(?int $courseId = null): array
    {
        $start = now()->startOfMonth()->subMonths(5);
        $rows = $this->personalSales($courseId, $start)->get(['created_at']);

        return collect(range(0, 5))->map(function ($i) use ($start, $rows) {
            $m = $start->copy()->addMonths($i);

            return [
                'label' => $m->translatedFormat('M'),
                'value' => $rows->filter(fn ($r) => $r->created_at->isSameMonth($m))->count(),
            ];
        })->all();
    }

    /** Cliques por curso nos últimos 30 dias: [course_id => n]. */
    public function viewsByCourse(): Collection
    {
        return CourseView::where('created_at', '>=', $this->since())
            ->groupBy('course_id')->selectRaw('course_id, count(*) as n')->pluck('n', 'course_id');
    }

    /** Cliques por dia num curso (30 dias). */
    public function viewsByDay(int $courseId): array
    {
        $rows = CourseView::where('course_id', $courseId)->where('created_at', '>=', $this->since())->get(['created_at']);

        return collect(range(self::DAYS - 1, 0))->map(function ($ago) use ($rows) {
            $d = now()->subDays($ago);

            return ['label' => $d->format('j'), 'date' => $d->translatedFormat('j M'), 'value' => $rows->filter(fn ($r) => $r->created_at->isSameDay($d))->count()];
        })->all();
    }

    /** Conclusão por curso: inscritos, concluíram, começaram (com pelo menos uma aula tocada). */
    public function completion(?int $courseId = null): Collection
    {
        $courses = Course::where('status', 'published')
            ->when($courseId, fn ($q) => $q->whereKey($courseId))
            ->with(['lessons:lessons.id'])
            ->withCount(['enrollments', 'enrollments as done_count' => fn ($q) => $q->where('status', 'completed')])
            ->orderBy('title')->get();

        return $courses->map(function (Course $c) {
            $lessonIds = $c->lessons->pluck('id');
            $started = $lessonIds->isEmpty() ? 0 : Enrollment::where('course_id', $c->id)
                ->whereIn('user_id', LessonProgress::whereIn('lesson_id', $lessonIds)->select('user_id'))
                ->count();

            return [
                'id' => $c->id,
                'ulid' => $c->ulid,
                'title' => $c->title,
                'enrolled' => $c->enrollments_count,
                'done' => $c->done_count,
                'started' => max($started, $c->done_count),
            ];
        });
    }

    /** Números do topo da Visão geral (30 dias). */
    public function overview(): array
    {
        $sales = $this->salesByCourse();
        $completion = $this->completion();
        $enrolled = $completion->sum('enrolled');

        return [
            'revenue' => round($sales->sum('revenue'), 2),
            'sales' => $sales->sum('sales'),
            'companySales' => ContactRequest::where('kind', 'compra')->where('type', 'empresa')->whereIn('status', self::PAID_COMPANY)
                ->where('created_at', '>=', $this->since())->count(),
            'views' => CourseView::where('created_at', '>=', $this->since())->count(),
            'done' => $completion->sum('done'),
            'enrolled' => $enrolled,
            'newUsers' => User::where('created_at', '>=', $this->since())->count(),
        ];
    }

    /**
     * O que pede atenção: cursos vistos sem compras, cursos com muita gente parada,
     * compras à espera de autorização e convites por aceitar.
     */
    public function attention(): array
    {
        $items = [];
        $views = $this->viewsByCourse();
        $sold = $this->salesByCourse()->keyBy('id');
        $titles = Course::whereIn('id', $views->keys())->pluck('title', 'id');
        foreach ($views as $courseId => $n) {
            if ($n >= 20 && ! $sold->has($courseId)) {
                $items[] = ['kind' => 'curso', 'title' => $titles[$courseId] ?? '', 'text' => __(':n cliques no catálogo e nenhuma compra nos últimos 30 dias. Rever o preço ou a apresentação?', ['n' => $n]), 'url' => '/administracao/cursos/'.Course::find($courseId)?->ulid];
            }
        }
        foreach ($this->completion() as $c) {
            if ($c['enrolled'] >= 5 && $c['done'] / $c['enrolled'] < 0.2) {
                $items[] = ['kind' => 'curso', 'title' => $c['title'], 'text' => __(':enrolled inscritos e só :done concluíram.', ['enrolled' => $c['enrolled'], 'done' => $c['done']]), 'url' => '/administracao/cursos/'.$c['ulid']];
            }
        }
        $waiting = ContactRequest::whereIn('kind', ['compra', 'creditos'])->where('status', 'pago')->where('created_at', '<=', now()->subDays(2))->count();
        if ($waiting) {
            $items[] = ['kind' => 'pedidos', 'title' => trans_choice('{1} 1 compra à espera de autorização|[2,*] :count compras à espera de autorização', $waiting), 'text' => __('Há mais de 2 dias. Os alunos ainda não têm acesso.'), 'url' => '/gestao/pedidos'];
        }
        $invited = User::whereNull('last_active_at')->where('created_at', '<=', now()->subDays(7))
            ->whereDoesntHave('role', fn ($q) => $q->where('name', 'admin'))
            ->whereNotIn('id', LessonProgress::select('user_id'))->count();
        if ($invited) {
            $items[] = ['kind' => 'pessoas', 'title' => trans_choice('{1} 1 pessoa nunca entrou|[2,*] :count pessoas nunca entraram', $invited), 'text' => __('Foram convidadas há mais de uma semana.'), 'url' => '/administracao/pessoas?filtro=nunca'];
        }

        return $items;
    }

    /** Alunos de um curso, com o progresso real. */
    public function students(Course $course): array
    {
        $lessonIds = $course->lessons()->pluck('lessons.id');

        return Enrollment::with(['user' => fn ($q) => $q->withTrashed(), 'company'])
            ->where('course_id', $course->id)->orderByDesc('enrolled_at')->limit(200)->get()
            ->filter(fn ($e) => $e->user)
            ->map(function (Enrollment $e) use ($lessonIds) {
                $progress = LessonProgress::where('user_id', $e->user_id)->whereIn('lesson_id', $lessonIds);
                $done = (clone $progress)->where('status', 'completed')->count();
                $last = $progress->max('updated_at');

                return [
                    'name' => $e->user->name,
                    'email' => $e->user->email,
                    'company' => $e->company?->name,
                    'progress' => $lessonIds->count() ? (int) floor($done / $lessonIds->count() * 100) : 0,
                    'last' => $last ? Carbon::parse($last)->diffForHumans() : null,
                    'enrolled' => $e->enrolled_at?->format('d/m/Y'),
                ];
            })->values()->all();
    }

    /** Uma linha por curso, para a lista do catálogo e a escolha de cursos. */
    public function catalog(): array
    {
        $views = $this->viewsByCourse();
        $sales = $this->salesByCourse()->keyBy('id');

        return Course::with(['category', 'instructor'])->withCount('enrollments')->orderByRaw("status = 'published' desc")->orderBy('title')->get()
            ->map(fn (Course $c) => [
                'id' => $c->id,
                'ulid' => $c->ulid,
                'slug' => $c->slug,
                'title' => $c->title ?: __('Curso sem título'),
                'area' => $c->category?->name,
                'instructor' => $c->instructor?->name,
                'status' => $c->status,
                'price' => (float) $c->price,
                'free' => (bool) $c->is_free,
                'image' => $c->thumbnail_url ?: (config('tacademy.course_images')[$c->slug] ?? config('tacademy.course_image_fallback')),
                'enrolled' => $c->enrollments_count,
                'views' => (int) ($views[$c->id] ?? 0),
                'sales' => $sales[$c->id]['sales'] ?? 0,
            ])->all();
    }

    /** Página de um curso: tudo junto. */
    public function course(Course $course): array
    {
        $c = $this->completion($course->id)->first() ?? ['enrolled' => 0, 'done' => 0, 'started' => 0];
        $sales = $this->personalSales($course->id, $this->since())->count();
        $views = CourseView::where('course_id', $course->id)->where('created_at', '>=', $this->since())->count();

        return [
            'views' => $views,
            'sales' => $sales,
            'revenue' => round($sales * (float) $course->price, 2),
            'allSales' => $this->personalSales($course->id)->count(),
            'enrolled' => $c['enrolled'],
            'started' => $c['started'],
            'done' => $c['done'],
            'byDay' => $this->viewsByDay($course->id),
            'byMonth' => $this->salesByMonth($course->id),
            'students' => $this->students($course),
        ];
    }
}
