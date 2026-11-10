import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import { Chip, FlashToast, btnClass, useConfirm } from '@/Components/ui';
import AttendanceDrawer from '@/Components/CourseBuilder/AttendanceDrawer';
import StudentLayout from '@/Layouts/StudentLayout';
import { formatMinutes, levelLabels } from '@/Components/CourseBuilder/format';

import { t } from '@/i18n';

// "Os meus cursos" (formador) / "Gerir cursos" (admin): lista, estado e atalho para o editor.
export default function Courses({ courses, isAdmin }) {
    // A tarefa "Confirmar presença" do Início abre logo a gaveta do curso (?presenca=ulid)
    const [attendance, setAttendance] = useState(() => {
        const wanted = new URLSearchParams(window.location.search).get('presenca');
        return (wanted && courses.find((c) => c.ulid === wanted)) || null;
    });
    const [confirm, confirmDialog] = useConfirm();

    const published = courses.filter((c) => c.status === 'published');
    const students = published.reduce((a, c) => a + c.students, 0);
    const withRate = published.filter((c) => c.completion !== null);
    const completion = withRate.length ? Math.round(withRate.reduce((a, c) => a + c.completion, 0) / withRate.length) : null;

    const unpublish = async (c) => {
        if (await confirm({ title: t('Passar “:title” a rascunho?', { title: c.title }), body: t('Sai do catálogo até voltar a publicar.'), action: t('Passar a rascunho') })) {
            router.post(`/formador/cursos/${c.ulid}/rascunho`, {}, { preserveScroll: true });
        }
    };
    const remove = async (c) => {
        if (await confirm({ title: t('Apagar o rascunho “:title”?', { title: c.title }), body: t('Isto não se pode desfazer.'), action: t('Apagar o rascunho'), danger: true })) router.delete(`/formador/cursos/${c.ulid}`, { preserveScroll: true });
    };

    return (
        <StudentLayout>
            <Head title={isAdmin ? t('Gerir cursos') : t('Os meus cursos')} />

            <div className="mb-6 flex flex-wrap items-end justify-between gap-5">
                <div>
                    <h1 className="font-display text-[clamp(30px,3.4vw,44px)] font-bold leading-none tracking-[-0.01em]">
                        {isAdmin ? t('Todos os cursos') : t('Os meus cursos')}
                    </h1>
                    <p className="mt-2 text-muted">
                        {isAdmin ? t('Cursos de todos os formadores. O admin pode editar qualquer um.') : t('Cria, edita e publica os teus cursos.')}
                    </p>
                </div>
                <Link
                    href="/formador/cursos/novo"
                    className="ui-btn ui-btn-accent w-full sm:w-auto"
                >
                    {t('+ Criar curso')}
                </Link>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
                <Kpi label={t('Publicados')} value={published.length} />
                <Kpi label={t('Rascunhos')} value={courses.length - published.length} />
                <Kpi label={t('Alunos inscritos')} value={students} />
                <Kpi label={t('Conclusão média')} value={completion === null ? '—' : `${completion}%`} />
            </div>

            {courses.length === 0 ? (
                <div className="bg-surface px-6 py-14 text-center">
                    <p className="font-display text-xl font-bold">{t('Ainda não criaste nenhum curso.')}</p>
                    <p className="mt-1 text-muted">{t('Começa pelo título. O resto vais preenchendo, e fica tudo guardado sozinho.')}</p>
                    <Link href="/formador/cursos/novo" className="ui-btn mt-5">
                        {t('Criar o primeiro curso →')}
                    </Link>
                </div>
            ) : (
                <div className="grid gap-3">
                    {courses.map((c) => (
                        <div key={c.ulid} className="grid grid-cols-[56px_1fr] items-center gap-x-4 gap-y-2 bg-surface p-3 sm:grid-cols-[96px_1fr_auto_auto_auto] sm:gap-5 sm:pr-5">
                            <div
                                className="h-14 w-14 bg-surface2 bg-cover bg-center sm:h-[68px] sm:w-24"
                                style={c.image ? { backgroundImage: `url("${c.image}")` } : undefined}
                            />
                            <div className="min-w-0">
                                <h3 className="truncate font-display text-[17px] font-semibold">{c.title}</h3>
                                <p className="text-[13px] text-muted">
                                    {[c.area, levelLabels[c.level], c.minutes ? formatMinutes(c.minutes) : null].filter(Boolean).join(' · ')}
                                    {isAdmin && c.author && <> · <b className="text-ink">{c.author}</b></>}
                                    {c.updated && <span className="hidden md:inline">{' '}{t('· alterado')}{' '}{c.updated}</span>}
                                </p>
                            </div>
                            <span className="col-start-2 justify-self-start sm:col-start-auto">
                                <Chip tone={c.status === 'published' ? 'ok' : 'mut'}>{c.status === 'published' ? t('Publicado') : t('Rascunho')}</Chip>
                            </span>
                            <div className="hidden text-right font-display text-lg font-bold sm:block">
                                {c.students}
                                <small className="block font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted">{t('Alunos')}</small>
                            </div>
                            <div className="col-start-2 flex flex-wrap gap-2 sm:col-start-auto">
                                <Link href={`/formador/cursos/${c.ulid}/editar`} className={btnClass('soft', 'sm')}>
                                    {t('Editar')}
                                </Link>
                                {/* Abre o curso como o aluno o vê, em modo de pré-visualização (não conta progresso) */}
                                <Link href={`/plataforma/cursos/${c.slug}`} className={btnClass('soft', 'sm')}>
                                    {t('Pré-visualizar como aluno')}
                                </Link>
                                {c.attendance && c.students > 0 && (
                                    <button type="button" onClick={() => setAttendance(c)} className={btnClass('soft', 'sm')}>
                                        {t('Alunos · Presença')}
                                    </button>
                                )}
                                {c.status === 'published' ? (
                                    <>
                                        <a href={`/cursos?curso=${c.slug}`} target="_blank" rel="noopener" className={btnClass('line', 'sm')}>
                                            {t('Ver no catálogo')}
                                        </a>
                                        <button type="button" onClick={() => unpublish(c)} className={btnClass('soft', 'sm')}>
                                            {t('Despublicar')}
                                        </button>
                                    </>
                                ) : (
                                    <button type="button" onClick={() => remove(c)} className={btnClass('soft', 'sm')}>
                                        {t('Apagar')}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {attendance && <AttendanceDrawer course={attendance} onClose={() => setAttendance(null)} />}
            <FlashToast />
            {confirmDialog}
        </StudentLayout>
    );
}

function Kpi({ label, value }) {
    return (
        <div className="bg-surface px-5 py-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted">{label}</p>
            <p className="mt-1 font-display text-3xl font-bold">{value}</p>
        </div>
    );
}
