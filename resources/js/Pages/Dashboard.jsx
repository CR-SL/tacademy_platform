import { Head, Link, usePage } from '@inertiajs/react';
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

function ProgressRing({ percent }) {
    const r = 34;
    const circumference = 2 * Math.PI * r;
    const offset = circumference * (1 - percent / 100);
    return (
        <svg width="80" height="80" viewBox="0 0 80 80" className="mx-auto mb-2 block">
            <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(15,27,45,.10)" strokeWidth="8" />
            <circle
                cx="40"
                cy="40"
                r={r}
                fill="none"
                stroke="url(#ringGrad)"
                strokeWidth="8"
                strokeDasharray={circumference.toFixed(1)}
                strokeDashoffset={offset.toFixed(1)}
                strokeLinecap="round"
                transform="rotate(-90 40 40)"
                style={{ filter: 'drop-shadow(0 0 4px rgba(34,211,238,.5))' }}
            />
            <defs>
                <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#2F6FED" />
                    <stop offset="1" stopColor="#22D3EE" />
                </linearGradient>
            </defs>
            <text x="40" y="45" textAnchor="middle" className="fill-ink text-[15px] font-extrabold">
                {percent}%
            </text>
        </svg>
    );
}

function AiBadge() {
    return (
        <span className="absolute left-2.5 top-2.5 z-10 flex items-center gap-1 rounded-full border border-[rgba(34,211,238,.5)] bg-[rgba(34,211,238,.15)] px-2 py-0.5 text-[9px] font-extrabold tracking-wide text-[#7ff0ff]">
            ✦ AULA COM IA
        </span>
    );
}

function CourseCard({ course }) {
    if (course.has_ai) {
        return (
            <Link
                href={course.url ?? '#'}
                className="ta-ai-surface ta-rise relative block rounded-2xl border border-[rgba(34,211,238,.4)] p-2.5 transition hover:-translate-y-1"
            >
                <AiBadge />
                <div className="mb-2.5 flex h-24 items-center justify-center rounded-lg">
                    <div className="ta-orb h-11 w-11" />
                </div>
                <p className="mb-0.5 line-clamp-2 text-xs font-bold leading-snug text-white">
                    {course.title}
                </p>
                <p className="text-[10px] text-[#8ea3c0]">
                    {levelLabels[course.level] ?? course.level} · {formatDuration(course.duration_minutes)}
                </p>
            </Link>
        );
    }

    return (
        <Link
            href={course.url ?? '#'}
            className="ta-glass ta-rise block rounded-2xl p-2.5 transition hover:-translate-y-1 hover:shadow-[0_14px_30px_rgba(47,111,237,0.14)]"
        >
            <div
                className="mb-2.5 flex h-24 items-center justify-center rounded-lg text-white"
                style={{ background: courseGradient(course.category?.color_hex) }}
            >
                <CatalogIcon className="h-7 w-7" />
            </div>
            <p className="mb-0.5 line-clamp-2 text-xs font-bold leading-snug">{course.title}</p>
            <p className="text-[10px] text-steel">
                {levelLabels[course.level] ?? course.level} · {formatDuration(course.duration_minutes)}
            </p>
        </Link>
    );
}

function ContinueHero({ course }) {
    return (
        <div className="ta-ai-surface ta-rise relative flex flex-col justify-between gap-4 rounded-2xl p-5">
            <div className="ta-ai-glow" />
            <div className="ta-ai-glow ta-ai-glow--yellow" />
            <div className="relative flex items-center gap-3">
                <div className="ta-orb h-12 w-12" />
                <div>
                    <span className="text-[10px] font-bold uppercase tracking-wide text-[#7ff0ff]">
                        A continuar{course.has_ai ? ' · Aula com IA' : ''}
                    </span>
                    <p className="mt-0.5 text-base font-extrabold leading-tight text-white">
                        {course.title}
                    </p>
                </div>
            </div>
            <div className="relative">
                <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
                    <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan to-[#7ff0ff] shadow-[0_0_12px_rgba(34,211,238,.7)]"
                        style={{ width: `${course.percent}%` }}
                    />
                </div>
            </div>
            <Link
                href={course.url ?? '#'}
                className="absolute bottom-4 right-5 text-xs font-extrabold text-cyan"
            >
                Continuar →
            </Link>
        </div>
    );
}

export default function Dashboard({ greeting, quote, ring, continueCourse, popularCourses }) {
    const { auth } = usePage().props;
    const firstName = (auth?.user?.name ?? '').split(' ')[0] || 'aluno';

    return (
        <StudentLayout>
            <Head title="Início" />

            <p className="mb-0.5 bg-gradient-to-r from-ink to-tblue bg-clip-text text-lg font-extrabold text-transparent sm:text-xl">
                {greeting}, {firstName} 👋
            </p>
            <p className="mb-6 text-xs text-steel sm:text-sm">
                Pequenos passos, um técnico mais completo.
            </p>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Coluna lateral: percurso + citação */}
                <aside className="grid grid-cols-2 gap-4 lg:order-2 lg:col-span-1 lg:grid-cols-1">
                    <div className="ta-glass rounded-2xl p-5 text-center">
                        <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-steel">
                            O teu percurso
                        </p>
                        <ProgressRing percent={ring.percent} />
                        <p className="text-[11px] text-steel">
                            {ring.done} de {ring.total} objetivos concluídos
                        </p>
                    </div>

                    <div className="flex items-center rounded-2xl bg-gradient-to-br from-tblue to-[#1B4FC4] p-5 text-white shadow-[0_10px_30px_rgba(47,111,237,.20)]">
                        <p className="text-sm font-semibold leading-snug">“{quote}”</p>
                    </div>
                </aside>

                {/* Coluna principal: a continuar + populares */}
                <div className="space-y-6 lg:order-1 lg:col-span-2">
                    {continueCourse ? (
                        <ContinueHero course={continueCourse} />
                    ) : (
                        <div className="ta-glass rounded-2xl p-5 text-center text-sm text-steel">
                            Ainda não começaste nenhum curso.{' '}
                            <Link href="/cursos" className="font-bold text-tblue">
                                Explorar catálogo →
                            </Link>
                        </div>
                    )}

                    <div>
                        <div className="mb-3 flex items-center gap-2">
                            <span className="h-[7px] w-[7px] rounded-full bg-brand-yellow shadow-[0_0_8px_rgba(232,148,15,.6)]" />
                            <p className="text-[11px] font-bold uppercase tracking-wide text-steel">
                                Popular esta semana
                            </p>
                            <Link href="/cursos" className="ml-auto text-[11px] font-semibold text-tblue">
                                Ver tudo
                            </Link>
                        </div>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                            {popularCourses.map((course) => (
                                <CourseCard key={course.id} course={course} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </StudentLayout>
    );
}
