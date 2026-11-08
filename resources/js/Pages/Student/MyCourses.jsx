import { Head, Link } from '@inertiajs/react';
import { useState } from 'react';
import StudentLayout from '@/Layouts/StudentLayout';
import { levelLabels } from '@/Components/CourseBuilder/format';
import PanelBoard, { alexDef, Crumb, EmptyPanel, PanelsMenu } from '@/Components/Panels/PanelBoard';
import usePanelBoard from '@/Components/Panels/usePanelBoard';

const STATE_LABEL = { curso: 'Em curso', novo: 'Por começar', feito: 'Concluídos' };

function Group({ title, courses }) {
    if (!courses.length) return null;
    return (
        <>
            <span className="pn-lab">{title}</span>
            <div className="pn-covers">
                {courses.map((c) => (
                    <Link key={c.id} href={c.url} className="pn-cover">
                        <img src={c.image} alt="" loading="lazy" />
                        <span className="pn-top-bar"><i style={{ width: `${c.pct}%` }} /></span>
                        <span className="pn-card-t">
                            {(c.area || c.level) && <span className="pn-lab">{[c.area, levelLabels[c.level] ?? c.level].filter(Boolean).join(' · ')}</span>}
                            <h3 className="pn-disp">{c.title}</h3>
                            <span className="pn-card-f">
                                <span>
                                    {c.expired ? `Acesso terminou a ${c.expires}`
                                        : c.completed ? `Concluído a ${c.completed}`
                                        : c.deadline ? (c.deadline.late ? `Prazo terminou a ${c.deadline.date}` : `Concluir até ${c.deadline.date}`)
                                        : c.expires ? `Acesso até ${c.expires}`
                                        : `${c.done} de ${c.total} aulas`}
                                </span>
                                <span className="pn-price">{c.pct}%</span>
                            </span>
                        </span>
                    </Link>
                ))}
            </div>
        </>
    );
}

function CoursesList({ courses }) {
    const [filter, setFilter] = useState('todos');
    const states = ['curso', 'novo', 'feito'].filter((s) => courses.some((c) => c.state === s));
    const list = courses.filter((c) => filter === 'todos' || c.state === filter);

    return (
        <div className="pn-page-c">
            <div className="pn-page-t">
                <h3 className="pn-disp">Os meus cursos</h3>
                <div className="ui-pills" role="group" aria-label="Filtrar cursos">
                    <button type="button" aria-pressed={filter === 'todos'} onClick={() => setFilter('todos')}>Todos · {courses.length}</button>
                    {states.map((s) => (
                        <button key={s} type="button" aria-pressed={filter === s} onClick={() => setFilter(s)}>
                            {STATE_LABEL[s]} · {courses.filter((c) => c.state === s).length}
                        </button>
                    ))}
                </div>
            </div>
            <Group title="Atribuídos pela empresa" courses={list.filter((c) => c.company)} />
            <Group title="Os meus" courses={list.filter((c) => !c.company)} />
        </div>
    );
}

export default function MyCourses({ courses, alexUrl, savedLayout }) {
    const panels = {
        lista: {
            title: 'Os meus cursos', x: 0, y: 0, w: 19, h: 22, compact: true, float: 'light',
            summary: `${courses.length} ${courses.length === 1 ? 'curso' : 'cursos'}`,
            body: courses.length
                ? <CoursesList courses={courses} />
                : <EmptyPanel title="Ainda não tens cursos" text="Quando te inscreveres num curso, aparece aqui." href="/plataforma/cursos" cta="Ver o catálogo" />,
        },
        alex: alexDef(alexUrl, 0, 22),
    };
    const board = usePanelBoard({ view: 'cursos', panels, saved: savedLayout });

    return (
        <StudentLayout navTools={<PanelsMenu board={board} />}>
            <Head title="Os meus cursos" />
            <Crumb label="Os meus cursos" />
            <PanelBoard board={board} />
        </StudentLayout>
    );
}
