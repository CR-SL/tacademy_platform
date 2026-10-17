import { Head, Link, router, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import StudentLayout from '@/Layouts/StudentLayout';
import { formatMinutes, levelLabels } from '@/Components/CourseBuilder/format';

// "Os meus cursos" (formador) / "Gerir cursos" (admin): lista, estado e atalho para o editor.
export default function Courses({ courses, isAdmin }) {
    const { flash } = usePage().props;
    const [toast, setToast] = useState(flash?.status ?? null);

    useEffect(() => {
        setToast(flash?.status ?? null);
        if (!flash?.status) return;
        const t = setTimeout(() => setToast(null), 4000);
        return () => clearTimeout(t);
    }, [flash?.status]);

    const published = courses.filter((c) => c.status === 'published');
    const students = published.reduce((a, c) => a + c.students, 0);
    const withRate = published.filter((c) => c.completion !== null);
    const completion = withRate.length ? Math.round(withRate.reduce((a, c) => a + c.completion, 0) / withRate.length) : null;

    const unpublish = (c) => {
        if (confirm(`Passar “${c.title}” a rascunho? Sai do catálogo até voltar a publicar.`)) {
            router.post(`/formador/cursos/${c.ulid}/rascunho`, {}, { preserveScroll: true });
        }
    };
    const remove = (c) => {
        if (confirm(`Apagar o rascunho “${c.title}”?`)) router.delete(`/formador/cursos/${c.ulid}`, { preserveScroll: true });
    };

    return (
        <StudentLayout>
            <Head title={isAdmin ? 'Gerir cursos' : 'Os meus cursos'} />

            <div className="mb-6 flex flex-wrap items-end justify-between gap-5">
                <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted">
                        {isAdmin ? 'Administração' : 'Área do formador'}
                    </p>
                    <h1 className="mt-1.5 font-display text-[clamp(30px,3.4vw,44px)] font-bold leading-none tracking-[-0.01em]">
                        {isAdmin ? 'Todos os cursos' : 'Os meus cursos'}
                    </h1>
                    <p className="mt-2 text-muted">
                        {isAdmin ? 'Cursos de todos os formadores. O admin pode editar qualquer um.' : 'Cria, edita e publica os teus cursos.'}
                    </p>
                </div>
                <Link
                    href="/formador/cursos/novo"
                    className="ta-cut-8 ta-press w-full bg-accent px-5 py-3 text-center font-display text-sm font-bold uppercase tracking-[0.04em] text-on-accent sm:w-auto"
                >
                    + Criar curso
                </Link>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
                <Kpi label="Publicados" value={published.length} />
                <Kpi label="Rascunhos" value={courses.length - published.length} />
                <Kpi label="Alunos inscritos" value={students} />
                <Kpi label="Conclusão média" value={completion === null ? '—' : `${completion}%`} />
            </div>

            {courses.length === 0 ? (
                <div className="ta-cut-16 bg-surface px-6 py-14 text-center">
                    <p className="font-display text-xl font-bold">Ainda não criaste nenhum curso.</p>
                    <p className="mt-1 text-muted">Começa pelo título — o resto vais preenchendo, e fica tudo guardado sozinho.</p>
                    <Link href="/formador/cursos/novo" className="ta-cut-8 ta-press mt-5 inline-block bg-ink px-5 py-3 font-display text-sm font-bold uppercase tracking-[0.04em] text-accent">
                        Criar o primeiro curso →
                    </Link>
                </div>
            ) : (
                <div className="grid gap-3">
                    {courses.map((c) => (
                        <div key={c.ulid} className="ta-cut-12 grid grid-cols-[56px_1fr] items-center gap-x-4 gap-y-2 bg-surface p-3 sm:grid-cols-[96px_1fr_auto_auto_auto] sm:gap-5 sm:pr-5">
                            <div
                                className="ta-cut-8 h-14 w-14 bg-surface2 bg-cover bg-center sm:h-[68px] sm:w-24"
                                style={c.image ? { backgroundImage: `url("${c.image}")` } : undefined}
                            />
                            <div className="min-w-0">
                                <h3 className="truncate font-display text-[17px] font-semibold">{c.title}</h3>
                                <p className="text-[13px] text-muted">
                                    {[c.area, levelLabels[c.level], c.minutes ? formatMinutes(c.minutes) : null].filter(Boolean).join(' · ')}
                                    {isAdmin && c.author && <> · <b className="text-ink">{c.author}</b></>}
                                    {c.updated && <span className="hidden md:inline"> · alterado {c.updated}</span>}
                                </p>
                            </div>
                            <span
                                className={`ta-cut-8 col-start-2 justify-self-start px-2 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] sm:col-start-auto ${
                                    c.status === 'published' ? 'bg-[#2F9E5B1f] text-[#2F9E5B]' : 'bg-surface2 text-muted'
                                }`}
                            >
                                {c.status === 'published' ? 'Publicado' : 'Rascunho'}
                            </span>
                            <div className="hidden text-right font-display text-lg font-bold sm:block">
                                {c.students}
                                <small className="block font-mono text-[10.5px] font-medium tracking-[0.08em] text-muted">ALUNOS</small>
                            </div>
                            <div className="col-start-2 flex flex-wrap gap-2 sm:col-start-auto">
                                <Link href={`/formador/cursos/${c.ulid}/editar`} className="ta-press bg-surface2 px-3 py-2 font-display text-xs font-bold uppercase tracking-[0.04em] hover:bg-track">
                                    Editar
                                </Link>
                                {c.status === 'published' ? (
                                    <>
                                        <a href={`/cursos?curso=${c.slug}`} target="_blank" rel="noopener" className="px-2 py-2 font-display text-xs font-bold uppercase tracking-[0.04em] text-accent-ink hover:text-ink">
                                            Ver ↗
                                        </a>
                                        <button type="button" onClick={() => unpublish(c)} className="px-2 py-2 font-display text-xs font-bold uppercase tracking-[0.04em] text-muted hover:text-ink">
                                            Despublicar
                                        </button>
                                    </>
                                ) : (
                                    <button type="button" onClick={() => remove(c)} className="px-2 py-2 font-display text-xs font-bold uppercase tracking-[0.04em] text-muted hover:text-live">
                                        Apagar
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {toast && (
                <div role="status" className="ta-cut-8 fixed bottom-20 left-1/2 z-50 -translate-x-1/2 bg-ink px-5 py-3 font-display text-sm font-semibold text-white md:bottom-6">
                    <span className="text-accent">✓</span> {toast}
                </div>
            )}
        </StudentLayout>
    );
}

function Kpi({ label, value }) {
    return (
        <div className="ta-cut-12 bg-surface px-5 py-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted">{label}</p>
            <p className="mt-1 font-display text-3xl font-bold">{value}</p>
        </div>
    );
}
