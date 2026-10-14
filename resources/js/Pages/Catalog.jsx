import { Head, Link } from '@inertiajs/react';
import StudentLayout from '@/Layouts/StudentLayout';
import { CatalogIcon } from '@/Components/NavIcons';

function formatDuration(minutes) {
    if (!minutes) return '—';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h && m) return `${h}h${String(m).padStart(2, '0')}`;
    if (h) return `${h}h`;
    return `${m} min`;
}

const levelLabels = {
    iniciante: 'Iniciante',
    intermedio: 'Intermédio',
    avancado: 'Avançado',
};

function formatPrice(price) {
    if (!price || price <= 0) return 'Grátis';
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(price);
}

// Fundo riscado com a cor da categoria (cursos = ícone + cor, sem fotografia).
function hatch(color = '#F8B101') {
    return `repeating-linear-gradient(135deg, color-mix(in oklch, ${color} 28%, var(--color-surface)) 0 8px, color-mix(in oklch, ${color} 12%, var(--color-surface)) 8px 16px)`;
}

function CourseCard({ course }) {
    const color = course.category?.color_hex ?? '#F8B101';

    return (
        <Link
            href={course.url ?? '#'}
            className="ta-cut-12 group flex w-56 shrink-0 flex-col gap-3 bg-surface p-3 transition-transform duration-200 hover:-translate-y-1"
        >
            <div
                className="ta-cut-8 relative flex h-28 items-center justify-center text-ink"
                style={{ background: hatch(color) }}
            >
                {course.has_ai && (
                    <span className="ta-cut-8 absolute left-2 top-2 bg-on-accent px-2 py-0.5 font-display text-[10px] font-bold tracking-[0.08em] text-accent">
                        AULA COM IA
                    </span>
                )}
                <CatalogIcon className="h-8 w-8" />
            </div>
            <div className="flex flex-1 flex-col gap-1 px-1">
                <p className="line-clamp-2 text-[15px] font-semibold leading-snug">{course.title}</p>
                <p className="text-xs text-muted">
                    {levelLabels[course.level] ?? course.level} · {formatDuration(course.duration_minutes)}
                </p>
                <p className="mt-auto pt-1 font-display text-[15px] font-bold text-accent-ink">
                    {formatPrice(course.price)}
                </p>
            </div>
        </Link>
    );
}

function Shelf({ category }) {
    return (
        <section className="mb-8">
            <div className="mb-3 flex items-center gap-2.5">
                <span className="h-3 w-3 -skew-x-[20deg]" style={{ background: category.color_hex }} />
                <h2 className="font-display text-[15px] font-bold uppercase tracking-[0.08em]">{category.name}</h2>
                <span className="font-display text-[13px] font-semibold text-muted">{category.courses.length}</span>
            </div>
            <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
                {category.courses.map((course) => (
                    <CourseCard key={course.id} course={course} />
                ))}
            </div>
        </section>
    );
}

export default function Catalog({ categories }) {
    return (
        <StudentLayout>
            <Head title="Cursos" />

            <h1 className="font-display text-[26px] font-bold uppercase">Cursos</h1>
            <p className="mb-6 text-[15px] text-muted">Explora por categoria. Novos cursos a caminho.</p>

            {categories.length === 0 ? (
                <div className="ta-cut-12 bg-surface p-6 text-center text-sm text-muted">
                    Ainda não há cursos publicados.
                </div>
            ) : (
                categories.map((category) => <Shelf key={category.id} category={category} />)
            )}
        </StudentLayout>
    );
}
