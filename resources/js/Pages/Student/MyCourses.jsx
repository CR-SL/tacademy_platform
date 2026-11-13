import { Head, router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import CourseDrawer from '@/Components/Learn/CourseDrawer';
import StudentLayout from '@/Layouts/StudentLayout';
import { levelLabels } from '@/Components/CourseBuilder/format';
import PanelBoard, { alexDef, EmptyPanel, PanelsMenu } from '@/Components/Panels/PanelBoard';
import usePanelBoard from '@/Components/Panels/usePanelBoard';

import { t } from '@/i18n';

const STATE_LABEL = { curso: 'Em curso', novo: 'Por começar', feito: 'Concluídos' };

function Group({ title, courses, onOpen }) {
    if (!courses.length) return null;
    return (
        <>
            <span className="pn-lab">{title}</span>
            <div className="pn-covers">
                {courses.map((c) => (
                    <a key={c.id} href={`?curso=${encodeURIComponent(c.slug)}`} className="pn-cover" aria-haspopup="dialog"
                        onClick={(e) => { e.preventDefault(); onOpen(c.slug); }}>
                        <img src={c.image} alt="" loading="lazy" />
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
                    </a>
                ))}
            </div>
        </>
    );
}

function CoursesList({ courses, onOpen }) {
    const [filter, setFilter] = useState('todos');
    const states = ['curso', 'novo', 'feito'].filter((s) => courses.some((c) => c.state === s));
    const list = courses.filter((c) => filter === 'todos' || c.state === filter);

    return (
        <div className="pn-page-c">
            <div className="pn-page-t">
                <h3 className="pn-disp">{t('Os meus cursos')}</h3>
                <div className="ui-pills" role="group" aria-label={t('Filtrar cursos')}>
                    <button type="button" aria-pressed={filter === 'todos'} onClick={() => setFilter('todos')}>{t('Todos ·')}{' '}{courses.length}</button>
                    {states.map((s) => (
                        <button key={s} type="button" aria-pressed={filter === s} onClick={() => setFilter(s)}>
                            {t(STATE_LABEL[s])} · {courses.filter((c) => c.state === s).length}
                        </button>
                    ))}
                </div>
            </div>
            <Group title={t('Atribuídos pela empresa')} courses={list.filter((c) => c.company)} onOpen={onOpen} />
            <Group title={t('Os meus')} courses={list.filter((c) => !c.company)} onOpen={onOpen} />
        </div>
    );
}

// Ao carregar num cartão abre a caixa lateral do curso (como no catálogo); o ?curso= fica no endereço
export default function MyCourses({ courses, detail, alexUrl, savedLayout }) {
    const [slug, setSlug] = useState(() => new URLSearchParams(location.search).get('curso'));
    const lastFocus = useRef(null);
    const open = (s) => {
        lastFocus.current = document.activeElement;
        setSlug(s);
        router.get('/plataforma/meus-cursos', { curso: s }, { only: ['detail'], preserveState: true, preserveScroll: true, replace: true });
    };
    const close = () => {
        setSlug(null);
        window.history.replaceState(window.history.state, '', location.pathname);
        lastFocus.current?.focus?.({ preventScroll: true });
    };
    const shown = slug && detail?.course.slug === slug ? detail : null;

    // Esc fecha; com a caixa aberta a página não faz scroll por trás
    useEffect(() => {
        if (!shown) return undefined;
        const esc = (e) => e.key === 'Escape' && close();
        addEventListener('keydown', esc);
        document.body.style.overflow = 'hidden';
        return () => { removeEventListener('keydown', esc); document.body.style.overflow = ''; };
    }, [shown]);

    const panels = {
        lista: {
            title: t('Os meus cursos'), x: 0, y: 0, w: 19, h: 22, compact: true, float: 'light',
            summary: `${courses.length} ${courses.length === 1 ? t('curso') : t('cursos')}`,
            body: courses.length
                ? <CoursesList courses={courses} onOpen={open} />
                : <EmptyPanel title={t('Ainda não tens cursos')} text={t('Quando te inscreveres num curso, aparece aqui.')} href="/plataforma/cursos" cta={t('Ver o catálogo')} />,
        },
        alex: alexDef(alexUrl, 0, 22),
    };
    const board = usePanelBoard({ view: 'cursos', panels, saved: savedLayout });

    return (
        <StudentLayout navTools={<PanelsMenu board={board} />}>
            <Head title={t('Os meus cursos')} />
            <PanelBoard board={board} />
            {shown && <CourseDrawer key={shown.course.slug} detail={shown} onClose={close} />}
        </StudentLayout>
    );
}
