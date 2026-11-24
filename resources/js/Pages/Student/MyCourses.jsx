import { Head, router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import CourseDrawer from '@/Components/Learn/CourseDrawer';
import StudentLayout from '@/Layouts/StudentLayout';
import { levelLabels } from '@/Components/CourseBuilder/format';
import PanelBoard, { alexDef, EmptyPanel, PanelsMenu } from '@/Components/Panels/PanelBoard';
import usePanelBoard from '@/Components/Panels/usePanelBoard';
import { tilt, untilt } from '@/Components/ui/tilt';

import { t } from '@/i18n';

// Desenho do colega (2026-11-24): os filtros vão na barra da caixa, ao lado do título.
// "Por concluir" junta os cursos em curso e os por começar.
const FILTERS = [
    ['todos', 'Todos', () => true],
    ['abertos', 'Por concluir', (c) => c.state !== 'feito'],
    ['feitos', 'Concluídos', (c) => c.state === 'feito'],
];

function Tabs({ courses, filter, onChange }) {
    return (
        <div className="pn-htabs" role="group" aria-label={t('Filtrar cursos')}>
            {FILTERS.map(([key, label, test]) => (
                <button key={key} type="button" aria-pressed={filter === key} onClick={() => onChange(key)}>
                    {t(label)} · {courses.filter(test).length}
                </button>
            ))}
        </div>
    );
}

function CoursesList({ courses, filter, onOpen }) {
    const test = FILTERS.find(([key]) => key === filter)[2];
    // Os atribuídos pela empresa aparecem primeiro
    const list = [...courses.filter((c) => c.company), ...courses.filter((c) => !c.company)].filter(test);

    if (!list.length) {
        return filter === 'feitos'
            ? <EmptyPanel title={t('Ainda não concluíste nenhum curso')} text={t('Quando acabares um curso, aparece aqui.')} />
            : <EmptyPanel title={t('Concluíste todos os teus cursos')} href="/plataforma/cursos" cta={t('Ver o catálogo')} />;
    }
    return (
        <div className="pn-page-c">
            <div className="pn-covers">
                {list.map((c, i) => (
                    // Mesmo movimento dos cartões do catálogo: inclinação 3D com reflexo, subida e entrada em cascata
                    <a key={c.id} href={`?curso=${encodeURIComponent(c.slug)}`} className="pn-cover" style={{ '--i': i }} aria-haspopup="dialog"
                        onClick={(e) => { e.preventDefault(); onOpen(c.slug); }} onPointerMove={tilt} onPointerLeave={untilt}>
                        <span className="pn-lift">
                        <img src={c.image} alt="" loading="lazy" />
                        <span className="pn-glare" aria-hidden="true" />
                        <span className="pn-top-bar"><i style={{ width: `${c.pct}%` }} /></span>
                        <span className="pn-card-t">
                            {(c.area || c.level) && <span className="pn-lab">{[c.area, levelLabels[c.level] ?? c.level].filter(Boolean).join(' · ')}</span>}
                            <h3 className="pn-disp">{c.title}</h3>
                            <span className="pn-card-f">
                                <span>
                                    {c.expired ? t('Acesso terminou a :expires', { expires: c.expires })
                                        : c.completed ? t('Concluído a :completed', { completed: c.completed })
                                        : c.deadline ? (c.deadline.late ? t('Prazo terminou a :date', { date: c.deadline.date }) : t('Concluir até :date', { date: c.deadline.date }))
                                        : c.expires ? t('Acesso até :expires', { expires: c.expires })
                                        : t(':done de :total aulas', { done: c.done, total: c.total })}
                                </span>
                                <span className="pn-price">{c.pct}%</span>
                            </span>
                        </span>
                        </span>
                    </a>
                ))}
            </div>
        </div>
    );
}

// Ao carregar num cartão abre a caixa lateral do curso (como no catálogo); o ?curso= fica no endereço
export default function MyCourses({ courses, detail, savedLayout }) {
    const [slug, setSlug] = useState(() => new URLSearchParams(location.search).get('curso'));
    const [filter, setFilter] = useState('todos');
    const lastFocus = useRef(null);
    // A caixa abre logo, com "A carregar…" até os dados chegarem (antes não se via nada, e cliques repetidos
    // faziam vários pedidos); se o pedido falhar, mostra o erro com "Tentar outra vez"
    const [status, setStatus] = useState(null); // null | 'loading' | 'error'
    const open = (s) => {
        if (status === 'loading' && slug === s) return;
        lastFocus.current = document.activeElement;
        setSlug(s);
        setStatus('loading');
        let ok = false;
        router.get('/plataforma/meus-cursos', { curso: s }, {
            only: ['detail'], preserveState: true, preserveScroll: true, replace: true,
            onSuccess: (page) => { ok = page.props.detail?.course?.slug === s; },
            onFinish: (visit) => { if (!visit.cancelled && !visit.interrupted) setStatus(ok ? null : 'error'); },
        });
    };
    const close = () => {
        setStatus(null);
        setSlug(null);
        window.history.replaceState(window.history.state, '', location.pathname);
        lastFocus.current?.focus?.({ preventScroll: true });
    };
    const shown = slug && detail?.course.slug === slug ? detail : null;

    // Esc fecha; com a caixa aberta a página não faz scroll por trás
    const waiting = slug && !shown && status;
    useEffect(() => {
        if (!shown && !waiting) return undefined;
        const esc = (e) => e.key === 'Escape' && close();
        addEventListener('keydown', esc);
        document.body.style.overflow = 'hidden';
        return () => { removeEventListener('keydown', esc); document.body.style.overflow = ''; };
    }, [shown, waiting]);

    // As caixas mudaram de nome a 2026-11-24 (desenho do colega: lista mais estreita, Alex mais largo e com título),
    // para que quem tinha a disposição antiga guardada passe a ver a nova
    const panels = {
        meus: {
            title: t('Os meus cursos'), x: 0, y: 0, w: 16, h: 22,
            summary: `${courses.length} ${courses.length === 1 ? t('curso') : t('cursos')}`,
            mini: courses.length ? <Tabs courses={courses} filter={filter} onChange={setFilter} /> : null,
            body: courses.length
                ? <CoursesList courses={courses} filter={filter} onOpen={open} />
                : <EmptyPanel title={t('Ainda não tens cursos')} text={t('Quando te inscreveres num curso, aparece aqui.')} href="/plataforma/cursos" cta={t('Ver o catálogo')} />,
        },
        formador: { ...alexDef(0, 22), x: 16, w: 8, compact: false, float: null, showSum: true },
    };
    const board = usePanelBoard({ view: 'cursos', panels, saved: savedLayout });

    return (
        <StudentLayout navTools={<PanelsMenu board={board} />}>
            <Head title={t('Os meus cursos')} />
            <PanelBoard board={board} />
            {shown && <CourseDrawer key={shown.course.slug} detail={shown} onClose={close} />}
            {waiting && (
                <div className="cc-app">
                    <div className="cc-scrim" onClick={close} />
                    <aside className="cc-drawer items-center justify-center gap-4 p-8 text-center" role="dialog" aria-modal="true" aria-label={t('Curso')}>
                        {status === 'loading'
                            ? <p role="status" className="text-muted">{t('A carregar…')}</p>
                            : (
                                <>
                                    <p role="alert">{t('Não foi possível abrir o curso. Verifica a ligação e tenta outra vez.')}</p>
                                    <div className="flex gap-2">
                                        <button type="button" className="ui-btn ui-btn-sm" onClick={() => open(slug)}>{t('Tentar outra vez')}</button>
                                        <button type="button" className="ui-btn ui-btn-sm ui-btn-soft" onClick={close}>{t('Fechar')}</button>
                                    </div>
                                </>
                            )}
                    </aside>
                </div>
            )}
        </StudentLayout>
    );
}
