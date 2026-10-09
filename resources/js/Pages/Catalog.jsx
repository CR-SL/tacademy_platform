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

function courseGradient(color = '#2F6FED') {
    return `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 65%, #000))`;
}

function formatPrice(price) {
    if (!price || price <= 0) return 'Grátis';
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(price);
}

function CourseCard({ course }) {
    if (course.has_ai) {
        return (
            <Link
                href={course.url ?? '#'}
                className="ta-ai-surface relative block w-56 shrink-0 rounded-2xl border border-[rgba(34,211,238,.4)] p-3 transition hover:-translate-y-1"
            >
                <span className="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-full border border-[rgba(34,211,238,.5)] bg-[rgba(34,211,238,.15)] px-2 py-0.5 text-[9px] font-extrabold tracking-wide text-[#7ff0ff]">
                    ✦ AULA COM IA
                </span>
                <div className="mb-3 flex h-28 items-center justify-center rounded-xl">
                    <div className="ta-orb h-12 w-12" />
                </div>
                <p className="mb-1 line-clamp-2 text-sm font-bold leading-snug text-white">
                    {course.title}
                </p>
                <p className="mb-2 text-[11px] text-[#8ea3c0]">
                    {levelLabels[course.level] ?? course.level} · {formatDuration(course.duration_minutes)}
                </p>
                <p className="text-sm font-bold text-cyan">{formatPrice(course.price)}</p>
            </Link>
        );
    }

    return (
        <Link
            href={course.url ?? '#'}
            className="ta-glass block w-56 shrink-0 rounded-2xl p-3 transition hover:-translate-y-1 hover:shadow-[0_14px_30px_rgba(47,111,237,0.14)]"
        >
            <div
                className="mb-3 flex h-28 items-center justify-center rounded-xl text-white"
                style={{ background: courseGradient(course.category?.color_hex) }}
            >
                <CatalogIcon className="h-8 w-8" />
            </div>
            <p className="mb-1 line-clamp-2 text-sm font-bold leading-snug">{course.title}</p>
            <p className="mb-2 text-[11px] text-steel">
                {levelLabels[course.level] ?? course.level} · {formatDuration(course.duration_minutes)}
            </p>
            <p className="text-sm font-bold text-tblue">{formatPrice(course.price)}</p>
        </Link>
    );
}

function Shelf({ category }) {
    return (
        <section className="mb-8">
            <div className="mb-3 flex items-center gap-2">
                <span
                    className="h-3 w-3 rounded-full"
                    style={{ background: category.color_hex }}
                />
                <h2 className="text-sm font-bold text-ink">{category.name}</h2>
            </div>
            <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
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
            <Head title="Catálogo" />

            <p className="mb-0.5 text-lg font-bold">Catálogo de cursos</p>
            <p className="mb-6 text-xs text-steel">
                Explora por categoria. Novos cursos a caminho.
            </p>

            {categories.length === 0 ? (
                <div className="rounded-2xl bg-pearl p-6 text-center text-sm text-steel">
                    Ainda não há cursos publicados.
                </div>
            ) : (
                categories.map((category) => <Shelf key={category.id} category={category} />)
            )}
        </StudentLayout>
    );
}
