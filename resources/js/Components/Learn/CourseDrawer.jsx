import { Link } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { formatMinutes, levelLabels } from '@/Components/CourseBuilder/format';
import { IconCheck } from '@/Components/Panels/icons';
import '../../../css/courses.css';

import { t } from '@/i18n';

// Caixa lateral do curso em "Os meus cursos" (opção A, igual à do catálogo, 2026-11-13). Substitui a antiga
// página do curso: progresso, programa com o estado de cada aula, certificado e a apresentação do curso.

export const deadlineText = (d) => (d.late
    ? t('Prazo terminou a :date', { date: d.date })
    : d.days === 0 ? t('Prazo termina hoje')
    : d.days <= 14 ? (d.days === 1 ? t('Falta 1 dia · até :date', { date: d.date }) : t('Faltam :days dias · até :date', { days: d.days, date: d.date }))
    : t('Concluir até :date', { date: d.date }));

// Estado de cada aula: feita, a meio (com o tempo onde parou), a seguir ou por fazer
function lessonState(l, isNext) {
    if (l.status === 'done') return t('Feita');
    if (l.position) return l.position.of ? t('Em curso · :at de :of', { at: l.position.at, of: l.position.of }) : t('Em curso · :at', { at: l.position.at });
    if (l.status === 'locked') return t('Fechada');
    return isNext ? t('A seguir') : t('Por fazer');
}

function CloseIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
    );
}

function Tri() {
    return <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M3 1.5 7 5 3 8.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export default function CourseDrawer({ detail, onClose }) {
    const { course, access, progress, program, next, certificate } = detail;
    const closeRef = useRef(null);
    const lessonUrl = (l) => `/plataforma/cursos/${course.slug}/aulas/${l.ulid}`;
    const nextModule = program.findIndex((m) => m.lessons.some((l) => l.ulid === next?.ulid));
    const [open, setOpen] = useState(() => new Set([nextModule >= 0 ? nextModule : 0]));
    const toggle = (i) => setOpen((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });

    useEffect(() => {
        const tx = setTimeout(() => closeRef.current?.focus({ preventScroll: true }), 60);
        return () => clearTimeout(tx);
    }, [course.slug]);

    const number = (() => {
        const i = nextModule;
        const j = i >= 0 ? program[i].lessons.findIndex((l) => l.ulid === next.ulid) : -1;
        return i >= 0 && j >= 0 ? `${i + 1}.${j + 1}` : null;
    })();
    const cta = !next ? null
        : next.finished ? t('Rever o curso')
        : next.started ? (number ? t('Continuar · :n', { n: number }) : t('Continuar'))
        : t('Começar o curso');

    return (
        <div className="cc-app">
            <div className="cc-scrim" onClick={onClose} />
            <aside className="cc-drawer" role="dialog" aria-modal="true" aria-labelledby="cc-d-title">
                <div className="cc-d-scroll">
                    <div className="cc-d-hero">
                        <img src={course.image} alt="" />
                        <button ref={closeRef} className="cc-x" type="button" onClick={onClose} aria-label={t('Fechar detalhes do curso')}><CloseIcon /></button>
                    </div>
                    <div className="cc-d-body">
                        <div className="cc-d-head">
                            {(course.area || course.level) && <span className="cc-mono">{[course.area, levelLabels[course.level] ?? course.level].filter(Boolean).join(' · ')}</span>}
                            <h2 id="cc-d-title">{course.title}</h2>
                            {access.company && <span className="cc-tag">{t('Atribuído pela empresa')}</span>}
                        </div>

                        <div className="cc-stats">
                            <span><small>{t('Progresso')}</small><b>{progress.percent}%</b></span>
                            <span><small>{t('Aulas feitas')}</small><b>{progress.done} / {progress.total}</b></span>
                            <span>
                                <small>{access.mode === 'expired' ? t('Acesso') : access.deadline ? t('Prazo') : t('Duração')}</small>
                                <b>{access.mode === 'expired' ? t('Terminou') : access.deadline ? access.deadline.date : formatMinutes(course.minutes)}</b>
                            </span>
                            <span><small>{t('Formador')}</small><b>{course.instructor || t('A definir')}</b></span>
                        </div>
                        <div className="cd-bar" role="progressbar" aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100} aria-label={t('Progresso no curso')}>
                            <i style={{ width: `${progress.percent}%` }} />
                        </div>
                        {access.mode === 'expired' && <p className="cd-note">{t('O teu acesso a este curso terminou a :date. Fala com a T.Academy para o renovar.', { date: access.expires })}</p>}
                        {access.deadline && <p className={`cd-note ${access.deadline.late ? 'cd-late' : ''}`}>{deadlineText(access.deadline)}{access.deadline.by === 'empresa' ? t(', definido pela tua empresa') : ''}.</p>}

                        <div className="cc-prog">
                            <b>{t('Programa')}</b>
                            <div className="cc-prog-box">
                                {program.length ? program.map((m, i) => {
                                    const done = m.lessons.filter((l) => l.status === 'done').length;
                                    const isOpen = open.has(i);
                                    return (
                                        <div className="cc-mod" key={i}>
                                            <button type="button" className="cd-mod" aria-expanded={isOpen} onClick={() => toggle(i)}>
                                                <span className="cd-tri"><Tri /></span>
                                                <span className="cd-n">{String(i + 1).padStart(2, '0')}</span>
                                                <span className="cd-mt">{m.title}</span>
                                                <span className="cd-st">{done === m.lessons.length && done > 0 ? <IconCheck /> : `${done} / ${m.lessons.length}`}</span>
                                            </button>
                                            {isOpen && (
                                                <ul>
                                                    {m.lessons.map((l, j) => {
                                                        const isNext = l.ulid === next?.ulid && !next.finished;
                                                        const label = <><span>{i + 1}.{j + 1} · {l.title}</span><em className={l.status === 'done' ? 'cd-done' : undefined}>{l.status === 'done' && <IconCheck />}{lessonState(l, isNext)}</em></>;
                                                        return (
                                                            <li key={l.ulid} className={isNext ? 'cd-cur' : undefined}>
                                                                {l.status === 'locked' ? <span className="cd-l">{label}</span> : <Link className="cd-l" href={lessonUrl(l)}>{label}</Link>}
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            )}
                                        </div>
                                    );
                                }) : <p style={{ margin: '14px 0' }}>{t('Programa em preparação.')}</p>}
                            </div>
                        </div>

                        {certificate.enabled && (
                            <div className="cc-prog">
                                <b>{t('Certificado')}</b>
                                <div className="cc-prog-box cd-cert">
                                    {certificate.certificate ? (
                                        <p><b>{certificate.certificate.number}</b><br />{t('Emitido a :date. Vê-o em Certificados.', { date: certificate.certificate.issued_at })}</p>
                                    ) : (
                                        <ul>
                                            <li>{certificate.progress_ok ? <IconCheck /> : <span aria-hidden="true">○</span>}<span>{t('Concluir :min% das aulas (tens :now%)', { min: certificate.min_progress, now: certificate.progress })}</span></li>
                                            {certificate.score !== null && (
                                                <li>{certificate.score_ok ? <IconCheck /> : <span aria-hidden="true">○</span>}<span>{t('Nota média de :min% nos testes (tens :now%)', { min: certificate.min_score, now: certificate.score })}</span></li>
                                            )}
                                            {certificate.attendance !== null && (
                                                <li>{certificate.attendance_ok ? <IconCheck /> : <span aria-hidden="true">○</span>}<span>{t('Presença confirmada pelo formador')}{certificate.attendance_ok ? '' : t(' (por confirmar)')}</span></li>
                                            )}
                                        </ul>
                                    )}
                                </div>
                            </div>
                        )}

                        {(course.description || course.learn.length > 0 || course.prerequisites || course.audience || course.attendance) && (
                            <div className="cc-prog">
                                <b>{t('Sobre o curso')}</b>
                                <div className="cd-about">
                                    {course.description?.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}
                                    {course.learn.length > 0 && (
                                        <>
                                            <h3>{t('O que vais aprender')}</h3>
                                            <ul>{course.learn.map((tx) => <li key={tx}><IconCheck />{tx}</li>)}</ul>
                                        </>
                                    )}
                                    {course.prerequisites && <p><b>{t('Pré-requisitos:')}</b> {course.prerequisites}</p>}
                                    {course.audience && <p><b>{t('A quem se destina:')}</b> {course.audience}</p>}
                                    {course.attendance && <p><b>{t('Presença:')}</b> {t('este curso exige presença, confirmada pelo formador.')}</p>}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <div className="cc-d-foot">
                    <span><small>{t('Progresso')}</small><b>{progress.percent}%</b></span>
                    {access.mode === 'expired'
                        ? <span className="cc-cta cc-wait">{t('Acesso terminado')}</span>
                        : next && <Link className="cc-cta" href={lessonUrl(next)}>{cta}<span aria-hidden="true">→</span></Link>}
                </div>
            </aside>
        </div>
    );
}
