import { Head, Link, router } from '@inertiajs/react';
import StudentLayout, { initials } from '@/Layouts/StudentLayout';
import { Button, Chip, FlashToast, Progress, useConfirm } from '@/Components/ui';
import { Columns, fmtEuro, fmtInt, HBars } from '@/Components/Admin/Charts';
import { t } from '@/i18n';

// Administração › um curso: cliques, compras, percurso e alunos, com atalhos para o editor e o catálogo.
export default function Course({ course, stats: s, days }) {
    const [confirm, confirmDialog] = useConfirm();
    const unpublish = async () => {
        if (await confirm({ title: t('Passar “:title” a rascunho?', { title: course.title }), body: t('Sai do catálogo até voltar a publicar.'), action: t('Passar a rascunho') })) {
            router.post(`/formador/cursos/${course.ulid}/rascunho`, {}, { preserveScroll: true });
        }
    };
    const pct = s.enrolled ? Math.round((s.done / s.enrolled) * 100) : 0;

    return (
        <StudentLayout>
            <Head title={`${course.title} · ${t('Administração')}`} />
            <div className="bo-main" style={{ maxWidth: 1360, margin: '0 auto' }}>
                <Link href="/administracao/catalogo" className="ui-link mb-3 inline-block text-[13px]">{t('← Catálogo')}</Link>
                <div className="bo-hero">
                    <img src={course.image} alt="" />
                    <div style={{ minWidth: 0 }}>
                        <span className="pn-lab">{[course.area, course.free ? t('Grátis') : fmtEuro(course.price), course.instructor].filter(Boolean).join(' · ')}</span>
                        <h1>{course.title}</h1>
                        {course.status === 'published' ? <Chip tone="ok">{t('Publicado')}</Chip> : <Chip>{t('Rascunho')}</Chip>}
                    </div>
                    <div className="acts">
                        {course.canEdit && <Button size="sm" href={`/formador/cursos/${course.ulid}/editar`}>{t('Editar no editor')}</Button>}
                        {course.status === 'published' && <Button variant="soft" size="sm" href={`/plataforma/cursos?curso=${course.slug}`}>{t('Ver no catálogo')}</Button>}
                        {course.canEdit && course.status === 'published' && <Button variant="soft" size="sm" onClick={unpublish}>{t('Despublicar')}</Button>}
                    </div>
                </div>

                <div className="bo-kpis bo-kpis5">
                    <Kpi label={t('Cliques · :days dias', { days })} value={fmtInt(s.views)} hint={t('aberturas no catálogo')} />
                    <Kpi label={t('Compras · :days dias', { days })} value={fmtInt(s.sales)} hint={s.views ? t(':pct% de quem viu', { pct: ((s.sales / s.views) * 100).toLocaleString(undefined, { maximumFractionDigits: 1 }) }) : t(':n no total', { n: s.allSales })} />
                    <Kpi label={t('Receita · :days dias', { days })} value={fmtEuro(s.revenue)} hint={t('compras pessoais')} />
                    <Kpi label={t('Inscritos')} value={fmtInt(s.enrolled)} hint={t(':n já começaram', { n: s.started })} />
                    <Kpi label={t('Concluíram')} value={`${pct}%`} hint={t(':n de :total inscritos', { n: s.done, total: s.enrolled })} />
                </div>

                <div className="bo-row bo-row2">
                    <section className="bo-box">
                        <div className="bo-box-h"><span className="pn-lab">{t('Cliques por dia · :days dias', { days })}</span></div>
                        <div className="bo-box-b"><Columns data={s.byDay.map((d) => ({ label: d.label, value: d.value, tip: d.date }))} unit={` ${t('cliques')}`} caption={t('Cliques por dia')} /></div>
                    </section>
                    <section className="bo-box">
                        <div className="bo-box-h"><span className="pn-lab">{t('Percurso neste curso')}</span></div>
                        <div className="bo-box-b">
                            <HBars caption={t('Percurso neste curso')} rows={[
                                { name: t('Viram no catálogo'), value: s.views, tip: t('últimos :days dias', { days }) },
                                { name: t('Inscreveram-se'), value: s.enrolled },
                                { name: t('Começaram'), value: s.started },
                                { name: t('Concluíram'), value: s.done },
                            ]} />
                        </div>
                    </section>
                </div>

                <section className="bo-box" style={{ marginTop: 12 }}>
                    <div className="bo-box-h"><span className="pn-lab">{t('Alunos · :n', { n: s.enrolled })}</span></div>
                    <div className="overflow-x-auto px-3 py-1">
                        {s.students.length ? (
                            <table className="bo-table">
                                <thead><tr><th>{t('Aluno')}</th><th>{t('Empresa')}</th><th>{t('Inscrição')}</th><th style={{ width: '30%' }}>{t('Progresso')}</th><th>{t('Última atividade')}</th></tr></thead>
                                <tbody>{s.students.map((u) => (
                                    <tr key={u.email}>
                                        <td><div className="bo-who"><span className="bo-av">{initials(u.name)}</span><span style={{ minWidth: 0 }}><b>{u.name}</b><small>{u.email}</small></span></div></td>
                                        <td>{u.company ?? <span className="text-muted">{t('Compra pessoal')}</span>}</td>
                                        <td className="text-muted">{u.enrolled}</td>
                                        <td><Progress value={u.progress} /></td>
                                        <td className="text-muted">{u.last ?? t('Ainda não começou')}</td>
                                    </tr>
                                ))}</tbody>
                            </table>
                        ) : <p className="bo-empty px-3">{t('Ainda ninguém se inscreveu neste curso.')}</p>}
                    </div>
                </section>
            </div>
            {confirmDialog}
            <FlashToast />
        </StudentLayout>
    );
}

function Kpi({ label, value, hint }) {
    return (
        <div className="bg-surface px-5 py-4">
            <p className="pn-lab">{label}</p>
            <p className="mt-1 font-display text-[28px] font-bold leading-none">{value}</p>
            {hint && <p className="mt-2 text-[12.5px] text-muted">{hint}</p>}
        </div>
    );
}
