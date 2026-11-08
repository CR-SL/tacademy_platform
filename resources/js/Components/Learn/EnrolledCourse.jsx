import { Head, Link } from '@inertiajs/react';
import { useState } from 'react';
import StudentLayout from '@/Layouts/StudentLayout';
import PanelBoard, { alexDef, Crumb, moduleName, PanelsMenu } from '@/Components/Panels/PanelBoard';
import { IconArrow, IconCheck } from '@/Components/Panels/icons';
import usePanelBoard from '@/Components/Panels/usePanelBoard';
import { FlashToast } from '@/Components/Teams/ui';

import { t } from '@/i18n';

// Página do curso para quem está inscrito: módulos, aulas do módulo, certificado e o Alex.
// Estado de cada aula na lista: feita, a meio (com o tempo onde parou), a seguir ou por fazer
function lessonState(l, isNext) {
    if (l.status === 'done') return t('Feita:v1', { v1: l.minutes ? t(' · :minutes min', { minutes: l.minutes }) : '' });
    if (l.position) return (l.position.of ? t('Em curso · :at de :of', { at: l.position.at, of: l.position.of }) : t('Em curso · :at', { at: l.position.at }));
    return `${isNext ? t('A seguir') : t('Por fazer')}${l.minutes ? t(' · :minutes min', { minutes: l.minutes }) : ''}`;
}

export const deadlineText = (d) => (d.late
    ? t('Prazo terminou a :date', { date: d.date })
    : d.days === 0 ? t('Prazo termina hoje')
    : d.days <= 14 ? (d.days === 1 ? t('Falta 1 dia · até :date', { date: d.date }) : t('Faltam :days dias · até :date', { days: d.days, date: d.date }))
    : t('Concluir até :date', { date: d.date }));

export default function EnrolledCourse({ course, access, progress, program, next, certificate, alexUrl, savedLayout }) {
    const deadline = access?.deadline;
    const lessonUrl = (l) => `/plataforma/cursos/${course.slug}/aulas/${l.ulid}`;
    const [selected, setSelected] = useState(() => {
        const i = program.findIndex((m) => m.lessons.some((l) => l.ulid === next?.ulid));
        return i >= 0 ? i : 0;
    });
    const mod = program[selected];
    const moduleDone = (m) => m.lessons.filter((l) => l.status === 'done').length;

    const panels = {
        modulos: {
            title: t('Módulos'), x: 0, y: 0, w: 5, h: 18, compact: true,
            summary: t(':length módulos', { length: program.length }),
            body: program.map((m, i) => {
                const done = moduleDone(m);
                return (
                    <button key={m.title} type="button" className={`pn-m-row ${i === selected ? 'pn-on' : ''}`} onClick={() => setSelected(i)}>
                        <span><b>{moduleName(m.title, i)}</b><small>{t(':done / :total aulas', { done, total: m.lessons.length })}</small></span>
                        <span className="pn-st">{done === m.lessons.length && done > 0 ? <IconCheck /> : `${done} / ${m.lessons.length}`}</span>
                    </button>
                );
            }),
        },
        modulo: {
            title: t('Aulas do módulo'), x: 5, y: 0, w: 14, h: 18, compact: true, float: 'dark',
            body: (
                <>
                    <div className="pn-band">
                        <img src={course.image} alt="" />
                        <div className="pn-band-t">
                            <div>
                                <span className="pn-lab">{course.title} · {progress.percent}%{deadline ? ` · ${deadlineText(deadline)}` : ''}</span>
                                <h3 className="pn-disp">{mod && moduleName(mod.title, selected)}</h3>
                            </div>
                        </div>
                    </div>
                    {mod?.lessons.map((l, j) => (
                        <Link key={l.ulid} href={lessonUrl(l)} className={`pn-l-row ${l.ulid === next?.ulid ? 'pn-cur' : ''}`}>
                            <span>{selected + 1}.{j + 1} · {l.title}</span>
                            <span>{lessonState(l, l.ulid === next?.ulid)}</span>
                        </Link>
                    ))}
                </>
            ),
        },
        alex: alexDef(alexUrl, 0, 18),
        ...(certificate.enabled ? {
            certificado: {
                title: t('Certificado'), x: 0, y: 18, w: 8, h: 8, compact: true,
                summary: certificate.certificate ? certificate.certificate.number : t(':progress% das aulas', { progress: certificate.progress }),
                body: (
                    <div className="pn-cert">
                        {certificate.certificate ? (
                            <>
                                <h3 className="pn-disp">{certificate.certificate.number}</h3>
                                <p style={{ marginTop: 6 }}>{t('Emitido a :date. Em breve vais poder descarregar o certificado em PDF.', { date: certificate.certificate.issued_at })}</p>
                            </>
                        ) : (
                            <>
                                <h3 className="pn-disp">{t('Para obter o certificado')}</h3>
                                <ul>
                                    <li>{certificate.progress_ok ? <IconCheck /> : <span aria-hidden="true">○</span>}<span>{t('Concluir')}{' '}{certificate.min_progress}{t('% das aulas (')}{certificate.progress}%)</span></li>
                                    {certificate.score !== null && (
                                        <li>{certificate.score_ok ? <IconCheck /> : <span aria-hidden="true">○</span>}<span>{t('Nota média de')}{' '}{certificate.min_score}{t('% nos testes (')}{certificate.score}%)</span></li>
                                    )}
                                    {certificate.attendance !== null && (
                                        <li>{certificate.attendance_ok ? <IconCheck /> : <span aria-hidden="true">○</span>}<span>{t('Presença confirmada pelo formador')}{certificate.attendance_ok ? '' : t(' (por confirmar)')}</span></li>
                                    )}
                                </ul>
                            </>
                        )}
                    </div>
                ),
            },
        } : {}),
        sobre: {
            title: t('Sobre o curso'), x: certificate.enabled ? 8 : 0, y: 18, w: certificate.enabled ? 16 : 24, h: 8, compact: true,
            summary: deadline ? deadlineText(deadline) : course.instructor ? t('Formador: :instructor', { instructor: course.instructor }) : undefined,
            body: (
                <div className="pn-prose">
                    {course.instructor && <p><b>{t('Formador:')}</b> {course.instructor}</p>}
                    {deadline && <p><b>{t('Prazo:')}</b> {deadline.late ? t('terminou a :date', { date: deadline.date }) : t('concluir até :date', { date: deadline.date })}{deadline.by === 'empresa' ? t(', definido pela tua empresa') : ''}.</p>}
                    {course.attendance && <p><b>{t('Presença:')}</b>{' '}{t('este curso exige presença, confirmada pelo formador.')}</p>}
                    {course.description?.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}
                    {course.learn.length > 0 && (
                        <>
                            <h3 className="pn-disp" style={{ marginTop: 14 }}>{t('O que vais aprender')}</h3>
                            <ul>{course.learn.map((tx) => <li key={tx}>{tx}</li>)}</ul>
                        </>
                    )}
                </div>
            ),
        },
    };
    const board = usePanelBoard({ view: 'curso', panels, saved: savedLayout });
    const nextLabel = next?.finished ? t('Rever o curso') : next?.started ? t('Continuar') : t('Começar o curso');

    return (
        <StudentLayout navTools={<PanelsMenu board={board} />}>
            <Head title={course.title} />
            <Crumb label={<Link href="/plataforma/meus-cursos">{t('Os meus cursos ·')}{' '}{course.title}</Link>}>
                {next && <Link href={lessonUrl(next)} className="ui-btn ui-btn-sm">{nextLabel}<IconArrow /></Link>}
            </Crumb>
            <PanelBoard board={board} />
            <FlashToast />
        </StudentLayout>
    );
}
