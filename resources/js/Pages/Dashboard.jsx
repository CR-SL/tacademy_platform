import { Head, Link, usePage } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import StudentLayout from '@/Layouts/StudentLayout';
import { formatEuro, formatMinutes, levelLabels } from '@/Components/CourseBuilder/format';
import MessagesPanel from '@/Components/Panels/MessagesPanel';
import PanelBoard, { alexDef, Bar, EmptyPanel, moduleName, PanelsMenu } from '@/Components/Panels/PanelBoard';
import { IconArrow, IconCheck, IconPlay, IconTri } from '@/Components/Panels/icons';
import usePanelBoard from '@/Components/Panels/usePanelBoard';
import WorkshopGame from '@/Components/Panels/WorkshopGame';

function greeting() {
    const h = new Date().getHours();
    return h < 12 ? 'Bom dia' : h < 20 ? 'Boa tarde' : 'Boa noite';
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// "1 prazo a acabar · 2 testes por fazer"
function pendingSummary(pending) {
    const late = pending.filter((p) => p.kind === 'Prazo').length;
    const tests = pending.length - late;
    return [late && plural(late, 'prazo a acabar', 'prazos a acabar'), tests && plural(tests, 'teste por fazer', 'testes por fazer')].filter(Boolean).join(' · ') || null;
}

function CoursesPanel({ courses, resume }) {
    const [open, setOpen] = useState(() => resume?.modules.find((m) => m.current)?.id ?? null);

    if (!courses.length) {
        return <EmptyPanel title="Ainda não tens cursos" text="Quando te inscreveres num curso, aparece aqui." href="/plataforma/cursos" cta="Ver o catálogo" />;
    }

    return (
        <>
            {courses.map((c) => (
                <Link key={c.id} href={c.url} className="pn-c-row">
                    <img src={c.image} alt="" loading="lazy" />
                    <span>
                        <b>{c.title}</b>
                        <Bar value={c.pct} />
                        <small className={c.deadline?.late ? 'pn-late-t' : undefined}>{c.state === 'feito' ? '✓ Concluído' : `${c.pct}%`}{c.company ? ' · Empresa' : ' · Curso próprio'}{c.expired ? ' · Acesso terminado' : c.deadline ? ` · ${c.deadline.late ? 'Fora do prazo' : `Até ${c.deadline.date.slice(0, 5)}`}` : ''}</small>
                    </span>
                </Link>
            ))}
            {resume && (
                <>
                    <div className="pn-sub-h pn-lab">{resume.course} · Módulos</div>
                    {resume.modules.map((m, i) => {
                        const isOpen = open === m.id;
                        return (
                            <div key={m.id}>
                                <button type="button" className="pn-mod" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : m.id)}>
                                    <IconTri />
                                    <span>{moduleName(m.title, i)}</span>
                                    <span className="pn-st">{m.done === m.total && m.total > 0 ? <IconCheck /> : `${m.done} / ${m.total}`}</span>
                                </button>
                                {isOpen && (
                                    <div className="pn-lessons">
                                        {m.lessons.map((l, j) => (
                                            <Link key={l.url} href={l.url} className={`pn-lesson ${l.current ? 'pn-cur' : ''}`}>
                                                {i + 1}.{j + 1} · {l.title}
                                                {l.done ? <IconCheck /> : l.current ? <IconPlay /> : null}
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </>
            )}
        </>
    );
}

function ContinueBody({ resume, hasCourses }) {
    if (!resume) {
        return (
            <>
                <h3 className="pn-disp">{hasCourses ? 'Concluíste os teus cursos' : 'Ainda não começaste nenhum curso'}</h3>
                <p>{hasCourses ? 'Vê o catálogo para escolheres o próximo.' : 'Escolhe um curso no catálogo para começares.'}</p>
                <div className="pn-acts" style={{ marginTop: 'auto' }}>
                    <Link href="/plataforma/cursos" className="pn-btn">Ver o catálogo<IconArrow /></Link>
                </div>
            </>
        );
    }

    return (
        <>
            <h3 className="pn-disp">{resume.lesson}</h3>
            <p>{resume.left === 1 ? `Falta esta aula para fechares ${resume.module}.` : `Faltam ${resume.left} aulas para fechares ${resume.module}.`}</p>
            <div className="pn-prog"><Bar value={resume.pct} /></div>
            <div className="pn-acts">
                <Link href={resume.url} className="pn-btn">Continuar a aula<IconArrow /></Link>
                <Link href={resume.courseUrl} className="pn-btn pn-soft">Ver o curso</Link>
            </div>
        </>
    );
}

function PendingPanel({ pending }) {
    const [open, setOpen] = useState(0);
    if (!pending.length) return <p className="pn-empty">Não tens testes nem prazos por cumprir.</p>;

    return pending.map((p, i) => (
        <div key={p.url} className="pn-pend">
            <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
                <span><span className="pn-lab">{p.kind} · {p.course}</span><b>{p.title}</b></span>
                <IconTri />
            </button>
            {open === i && (
                <div className="pn-pend-c">
                    {p.text}
                    <br />
                    <Link href={p.url} className="pn-btn">{p.cta}</Link>
                </div>
            )}
        </div>
    ));
}

function ResultsPanel({ results }) {
    if (!results.length) return <p className="pn-empty">Ainda não fizeste nenhum teste.</p>;

    return (
        <>
            {results.map((r) => (
                <Link key={r.id} href={`/plataforma/avaliacoes?teste=${r.id}`} className="pn-res">
                    <span>{r.title}</span>
                    <b>{r.score}%</b>
                </Link>
            ))}
            <div className="pn-foot"><Link href="/plataforma/avaliacoes" className="pn-link">Ver todas as avaliações</Link></div>
        </>
    );
}

function NotesPanel({ notes }) {
    const [q, setQ] = useState('');
    if (!notes.length) return <p className="pn-empty">Ainda não tens notas. Podes escrevê-las durante as aulas.</p>;

    const term = q.trim().toLowerCase();
    const list = notes.filter((n) => !term || `${n.body} ${n.course} ${n.lesson}`.toLowerCase().includes(term));

    return (
        <>
            <label className="pn-search">
                <span className="pn-sr">Procurar nas notas</span>
                <input type="search" placeholder="Procurar nas notas" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            {list.length === 0 && <p className="pn-empty">Nenhuma nota com “{q}”.</p>}
            {list.map((n) => (
                <Link key={n.id} href={n.url} className="pn-note">
                    <span className="pn-where">
                        <span className="pn-lab">{n.course} · {n.lesson}</span>
                        {n.at && <span className="pn-t"><IconPlay />{n.at}</span>}
                    </span>
                    <p>{n.body}</p>
                </Link>
            ))}
        </>
    );
}

// Carrossel: anda devagar e para quando se passa o rato ou se foca
function SuggestionsPanel({ suggestions, paused }) {
    const ref = useRef(null);
    useEffect(() => {
        const car = ref.current;
        if (!car || paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
        let raf = 0;
        let last = performance.now();
        let acc = car.scrollLeft;
        const step = (t) => {
            const half = car.scrollWidth / 2;
            const held = car.matches(':hover') || car.contains(document.activeElement);
            if (!held && half > car.clientWidth) {
                acc += (t - last) * 0.025;
                if (acc >= half) acc -= half;
                car.scrollLeft = acc;
            } else {
                acc = car.scrollLeft;
            }
            last = t;
            raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf);
    }, [paused]);

    if (!suggestions.length) return <p className="pn-empty">Já estás inscrito em todos os cursos do catálogo.</p>;

    const items = [...suggestions, ...suggestions];
    return (
        <div className="pn-car" ref={ref} tabIndex={0} aria-label="Cursos sugeridos">
            {items.map((c, i) => {
                const copy = i >= suggestions.length;
                return (
                    <article key={`${c.id}-${i}`} className="pn-card" aria-hidden={copy || undefined}>
                        <div className="pn-card-p">
                            <img src={c.image} alt="" loading="lazy" />
                            <div className="pn-card-t">
                                <span className="pn-lab">{[c.area, levelLabels[c.level] ?? c.level].filter(Boolean).join(' · ')}</span>
                                <h3 className="pn-disp">{c.title}</h3>
                                <div className="pn-card-f">
                                    <span>{c.minutes ? formatMinutes(c.minutes) : ''}</span>
                                    <Link href={c.url} className="pn-price" tabIndex={copy ? -1 : undefined}>{c.free ? 'Grátis' : formatEuro(c.price)}</Link>
                                </div>
                            </div>
                        </div>
                        <p>{c.why}</p>
                    </article>
                );
            })}
        </div>
    );
}

function lessonNumber(resume) {
    const i = resume.modules.findIndex((m) => m.current);
    const j = resume.modules[i]?.lessons.findIndex((l) => l.current);
    return i >= 0 && j >= 0 ? `${i + 1}.${j + 1}` : null;
}

export default function Dashboard({ courses, resume, pending, results, notes, messages, suggestions, alexUrl, savedLayout }) {
    const [best, setBest] = useState(0);
    const { auth } = usePage().props;
    const firstName = (auth?.user?.name ?? '').split(' ')[0];
    const startWith = new URLSearchParams(window.location.search).get('conversa');
    const unread = messages.threads.reduce((n, t) => n + (t.unread > 0 ? 1 : 0), 0);
    const counts = { curso: 0, novo: 0, feito: 0 };
    courses.forEach((c) => { counts[c.state] += 1; });

    const panels = {
        cursos: {
            title: 'Os meus cursos', x: 0, y: 0, w: 5, h: 22,
            summary: [counts.curso && `${counts.curso} em curso`, counts.novo && `${counts.novo} por começar`, counts.feito && plural(counts.feito, 'concluído', 'concluídos')].filter(Boolean).join(' · '),
            body: <CoursesPanel courses={courses} resume={resume} />,
        },
        continuar: {
            title: 'Continuar', x: 5, y: 0, w: 14, h: 9,
            label: resume ? ['Continuar', resume.course, lessonNumber(resume) && `Aula ${lessonNumber(resume)}`].filter(Boolean).join(' · ') : 'Continuar',
            summary: resume?.lesson,
            hero: { image: resume?.image ?? '/images/cursos/cta-oficina.jpg', stamp: resume?.stamp },
            mini: resume && <Link href={resume.url} className="pn-btn pn-rt-c" aria-label="Continuar a aula" title="Continuar a aula"><IconPlay /></Link>,
            body: <ContinueBody resume={resume} hasCourses={courses.length > 0} />,
        },
        pendentes: {
            title: 'Pendentes', x: 5, y: 9, w: 7, h: 13,
            label: `Pendentes · ${pending.length}`,
            summary: pendingSummary(pending) ?? 'Nada por fazer',
            body: <PendingPanel pending={pending} />,
        },
        resultados: {
            title: 'Resultados', x: 12, y: 9, w: 7, h: 13,
            summary: results[0] ? `Último: ${results[0].score}%` : 'Sem testes feitos',
            body: <ResultsPanel results={results} />,
        },
        alex: { ...alexDef(alexUrl, 0, 22), compact: false },
        notas: {
            title: 'As minhas notas', x: 0, y: 22, w: 12, h: 11,
            label: `As minhas notas · ${notes.length}`,
            summary: notes[0] ? `Última em ${notes[0].lesson}` : 'Sem notas',
            body: <NotesPanel notes={notes} />,
        },
        mensagens: {
            title: 'Mensagens', x: 12, y: 22, w: 12, h: 11,
            label: unread ? `Mensagens · ${unread} por ler` : 'Mensagens',
            summary: messages.threads[0] ? `${messages.threads[0].name}, ${messages.threads[0].when}` : 'Sem mensagens',
            body: <MessagesPanel messages={messages} startWith={startWith} />,
        },
        sugestoes: {
            title: 'Sugestões', x: 0, y: 33, w: 24, h: 13,
            label: 'Sugeridos para ti · Passa o rato para parar',
            summary: plural(suggestions.length, 'curso', 'cursos'),
            body: <SuggestionsPanel suggestions={suggestions} />,
        },
        pausa: {
            title: 'Pausa', x: 0, y: 46, w: 8, h: 14, compact: true,
            label: 'Pausa · Arrumar a oficina',
            summary: best ? `Recorde: ${best} pontos` : 'Um minijogo para descontrair',
            body: <WorkshopGame onBest={setBest} />,
        },
    };

    const board = usePanelBoard({ view: 'home', panels, saved: savedLayout });
    const summaryLine = pendingSummary(pending) ?? (resume ? 'Tudo em dia' : null);

    return (
        <StudentLayout navTools={<PanelsMenu board={board} />}>
            <Head title="Início" />
            <div className="pn-root">
                <div className="pn-top">
                    <h1 className="pn-disp">{greeting()}{firstName ? `, ${firstName}` : ''}.</h1>
                    {summaryLine && <p>{summaryLine}</p>}
                </div>
            </div>
            <PanelBoard board={board} />
        </StudentLayout>
    );
}
