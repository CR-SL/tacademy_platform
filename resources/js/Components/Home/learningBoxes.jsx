import { Link, usePage } from '@inertiajs/react';
import { AlexBuy, AlexStart } from '@/Components/Alex/AlexCall';
import { useEffect, useRef, useState } from 'react';
import { formatEuro, formatMinutes, levelLabels, plural } from '@/Components/CourseBuilder/format';
import { alexDef, Bar, EmptyPanel, moduleName } from '@/Components/Panels/PanelBoard';
import { IconArrow, IconCheck, IconPlay, IconTri } from '@/Components/Panels/icons';
import WorkshopGame from '@/Components/Panels/WorkshopGame';

import { t } from '@/i18n';

// Caixas de aprender do Início (permissão "Fazer cursos"): os seus cursos, continuar, resultados, notas,
// sugestões, pausa e o Alex. Os lugares iniciais são os do Início do aluno de sempre.

// Resumo da lista de tarefas: "1 mensagem por ler · 2 testes por fazer"
const KIND_SUMMARY = {
    Mensagem: ['1 mensagem por ler', ':n mensagens por ler'],
    'Curso atribuído': ['1 curso por começar', ':n cursos por começar'],
    Presença: ['1 curso com presenças por confirmar', ':n cursos com presenças por confirmar'],
    Prazo: ['1 prazo a acabar', ':n prazos a acabar'],
    Teste: ['1 teste por fazer', ':n testes por fazer'],
};
export function pendingSummary(pending) {
    const parts = [];
    const team = pending.find((p) => p.kind === 'Equipa');
    if (team) parts.push(team.title.charAt(0).toLowerCase() + team.title.slice(1));
    Object.entries(KIND_SUMMARY).forEach(([kind, [one, many]]) => {
        const n = pending.filter((p) => p.kind === kind).length;
        if (n) parts.push(plural(n, t(one), t(many)));
    });
    return parts.join(' · ') || null;
}

function CoursesPanel({ courses, resume }) {
    const [open, setOpen] = useState(() => resume?.modules.find((m) => m.current)?.id ?? null);

    if (!courses.length) {
        return <EmptyPanel title={t('Ainda não tens cursos')} text={t('Quando te inscreveres num curso, aparece aqui.')} href="/plataforma/cursos" cta={t('Ver o catálogo')} />;
    }

    return (
        <>
            {courses.map((c) => (
                <Link key={c.id} href={c.url} className="pn-c-row">
                    <img src={c.image} alt="" loading="lazy" />
                    <span>
                        <b>{c.title}</b>
                        <Bar value={c.pct} />
                        <small className={c.deadline?.late ? 'pn-late-t' : undefined}>{c.state === 'feito' ? t('✓ Concluído') : `${c.pct}%`}{c.company ? t(' · Empresa') : t(' · Curso próprio')}{c.expired ? t(' · Acesso terminado') : c.deadline ? ` · ${c.deadline.late ? t('Fora do prazo') : t('Até :v1', { v1: c.deadline.date.slice(0, 5) })}` : ''}</small>
                    </span>
                </Link>
            ))}
            {resume && (
                <>
                    <div className="pn-sub-h pn-lab">{resume.course}{' '}{t('· Módulos')}</div>
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
                <h3 className="pn-disp">{hasCourses ? t('Concluíste os teus cursos') : t('Ainda não começaste nenhum curso')}</h3>
                <p>{hasCourses ? t('Vê o catálogo para escolheres o próximo.') : t('Escolhe um curso no catálogo para começares.')}</p>
                <div className="pn-acts" style={{ marginTop: 'auto' }}>
                    <Link href="/plataforma/cursos" className="ui-btn">{t('Ver o catálogo')}<IconArrow /></Link>
                </div>
            </>
        );
    }

    return (
        <>
            <h3 className="pn-disp">{resume.lesson}</h3>
            <p>{resume.left === 1 ? t('Falta esta aula para fechares :module.', { module: resume.module }) : t('Faltam :left aulas para fechares :module.', { left: resume.left, module: resume.module })}</p>
            <div className="pn-prog"><Bar value={resume.pct} /></div>
            <div className="pn-acts">
                <Link href={resume.url} className="ui-btn">{t('Continuar a aula')}<IconArrow /></Link>
                <Link href={resume.courseUrl} className="ui-btn ui-btn-soft">{t('Ver o curso')}</Link>
            </div>
        </>
    );
}

function ResultsPanel({ results }) {
    if (!results.length) return <p className="pn-empty">{t('Ainda não fizeste nenhum teste.')}</p>;

    return (
        <>
            {results.map((r) => (
                <Link key={r.id} href={`/plataforma/avaliacoes?teste=${r.id}`} className="pn-res">
                    <span>{r.title}</span>
                    <b>{r.score}%</b>
                </Link>
            ))}
            <div className="pn-foot"><Link href="/plataforma/avaliacoes" className="ui-link">{t('Ver todas as avaliações')}</Link></div>
        </>
    );
}

function NotesPanel({ notes }) {
    const [q, setQ] = useState('');
    if (!notes.length) return <p className="pn-empty">{t('Ainda não tens notas. Podes escrevê-las durante as aulas.')}</p>;

    const term = q.trim().toLowerCase();
    const list = notes.filter((n) => !term || `${n.body} ${n.course} ${n.lesson}`.toLowerCase().includes(term));

    return (
        <>
            <label className="pn-search">
                <span className="pn-sr">{t('Procurar nas notas')}</span>
                <input type="search" placeholder={t('Procurar nas notas')} value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            {list.length === 0 && <p className="pn-empty">{t('Nenhuma nota com “')}{q}”.</p>}
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
        const step = (tx) => {
            const half = car.scrollWidth / 2;
            const held = car.matches(':hover') || car.contains(document.activeElement);
            if (!held && half > car.clientWidth) {
                acc += (tx - last) * 0.025;
                if (acc >= half) acc -= half;
                car.scrollLeft = acc;
            } else {
                acc = car.scrollLeft;
            }
            last = tx;
            raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf);
    }, [paused]);

    if (!suggestions.length) return <p className="pn-empty">{t('Já estás inscrito em todos os cursos do catálogo.')}</p>;

    const items = [...suggestions, ...suggestions];
    return (
        <div className="pn-car" ref={ref} tabIndex={0} aria-label={t('Cursos sugeridos')}>
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
                                    <Link href={c.url} className="pn-price" tabIndex={copy ? -1 : undefined}>{c.free ? t('Grátis') : formatEuro(c.price)}</Link>
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

// Lugares das caixas comuns no Início do aluno (Pendentes e Mensagens)
export const LEARN_SPOTS = {
    pendentes: { x: 5, y: 9, w: 7, h: 13 },
    mensagens: { x: 12, y: 22, w: 12, h: 11 },
};

/** Definições das caixas de aprender (Pendentes e Mensagens são comuns e ficam na página). */
export function learningBoxes({ courses, resume, results, notes, suggestions, alexUrl }, { best, setBest }) {
    const counts = { curso: 0, novo: 0, feito: 0 };
    courses.forEach((c) => { counts[c.state] += 1; });

    return {
        cursos: {
            title: t('Os meus cursos'), x: 0, y: 0, w: 5, h: 22,
            summary: [counts.curso && t(':curso em curso', { curso: counts.curso }), counts.novo && t(':novo por começar', { novo: counts.novo }), counts.feito && plural(counts.feito, t('1 concluído'), t(':n concluídos'))].filter(Boolean).join(' · '),
            body: <CoursesPanel courses={courses} resume={resume} />,
        },
        continuar: {
            title: t('Continuar'), x: 5, y: 0, w: 14, h: 9,
            label: resume ? [t('Continuar'), resume.course, lessonNumber(resume) && t('Aula :v1', { v1: lessonNumber(resume) })].filter(Boolean).join(' · ') : t('Continuar'),
            summary: resume?.lesson,
            hero: { image: resume?.image ?? '/images/cursos/cta-oficina.jpg', stamp: resume?.stamp },
            mini: resume && <Link href={resume.url} className="ui-btn pn-rt-c" aria-label={t('Continuar a aula')} title={t('Continuar a aula')}><IconPlay /></Link>,
            body: <ContinueBody resume={resume} hasCourses={courses.length > 0} />,
        },
        resultados: {
            title: t('Resultados'), x: 12, y: 9, w: 7, h: 13,
            summary: results[0] ? t('Último: :score%', { score: results[0].score }) : t('Sem testes feitos'),
            body: <ResultsPanel results={results} />,
        },
        alex: { ...alexDef(alexUrl, 0, 22), compact: false },
        notas: {
            title: t('As minhas notas'), x: 0, y: 22, w: 12, h: 11,
            label: t('As minhas notas · :length', { length: notes.length }),
            summary: notes[0] ? t('Última em :lesson', { lesson: notes[0].lesson }) : t('Sem notas'),
            body: <NotesPanel notes={notes} />,
        },
        sugestoes: {
            title: t('Sugestões'), x: 0, y: 33, w: 24, h: 13,
            label: t('Sugeridos para ti · Passa o rato para parar'),
            summary: plural(suggestions.length, t('1 curso'), t(':n cursos')),
            body: <SuggestionsPanel suggestions={suggestions} />,
        },
        pausa: {
            title: t('Pausa'), x: 0, y: 46, w: 8, h: 14, compact: true,
            label: t('Pausa · Arrumar a oficina'),
            summary: best ? t('Recorde: :best pontos', { best }) : t('Um minijogo para descontrair'),
            body: <WorkshopGame onBest={setBest} />,
        },
    };
}

/** Primeiro uso (opção A, 2026-11-08): boas-vindas e três cursos reais do catálogo. */
export function Welcome({ firstName, starter }) {
    const { alex } = usePage().props;
    return (
        <div className="pn-root mx-auto max-w-[1180px] py-4 sm:py-10">
            <h1 className="pn-disp text-[clamp(32px,4.4vw,52px)] leading-[1.02]">{t('Olá')}{firstName ? `, ${firstName}` : ''}.</h1>
            <p className="mt-3 max-w-[56ch] text-[17px] text-text">
                {t('Escolhe o teu primeiro curso. Vês as aulas no computador ou no telemóvel e continuas sempre onde ficaste.')}
            </p>

            {starter.length > 0 && (
                <section aria-labelledby="w-start" className="mt-10">
                    <h2 id="w-start" className="pn-lab mb-3">{t('Cursos mais recentes')}</h2>
                    <div className="grid gap-3 md:grid-cols-3">
                        {starter.map((c) => (
                            <Link key={c.id} href={c.url} className="group flex flex-col bg-surface transition-colors hover:bg-surface2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                                <span className="block aspect-[16/9] overflow-hidden bg-carbon">
                                    <img src={c.image} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none" />
                                </span>
                                <span className="flex flex-1 flex-col gap-2 p-[18px]">
                                    <span className="pn-lab">{[c.area, levelLabels[c.level] ?? c.level].filter(Boolean).join(' · ')}</span>
                                    <b className="pn-disp text-[20px] leading-[1.15]">{c.title}</b>
                                    {c.short && <span className="line-clamp-2 text-[14px] text-text">{c.short}</span>}
                                    <span className="mt-auto flex items-center justify-between gap-3 pt-3 text-[13px] text-muted">
                                        <span>{[c.lessons ? plural(c.lessons, t('1 aula'), t(':n aulas')) : null, c.minutes ? formatMinutes(c.minutes) : null].filter(Boolean).join(' · ')}</span>
                                        <b className="font-display text-[15px] text-ink">{c.free ? t('Grátis') : formatEuro(c.price)}</b>
                                    </span>
                                </span>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
                <Link href="/plataforma/cursos" className="ui-btn ui-btn-accent">{t('Ver o catálogo')}</Link>
                <p className="text-[14px] text-muted">{t('Vens de uma empresa? Os cursos que ela te atribuir aparecem aqui.')}</p>
            </div>

            {/* O Alex logo no primeiro uso: o aluno fica a saber que pode falar com o avatar (cursos com IA ou créditos) */}
            {(alex?.place || alex?.buy) && (
                <section aria-labelledby="w-alex" className="w-alex mt-10">
                    <img src="/images/alex.png" alt={t('Alex, o tutor do curso, numa oficina')} />
                    <div className="w-alex-c">
                        <span className="pn-lab">{t('Formador IA')}</span>
                        <h2 id="w-alex" className="pn-disp text-[24px] leading-[1.1]">{t('Conhece o Alex')}</h2>
                        <p className="max-w-[52ch] text-[14.5px] text-text">{t('Um avatar com vídeo e voz que te tira dúvidas sobre os cursos, a qualquer hora. Vem incluído nos cursos com IA e também podes falar com ele com créditos.')}</p>
                        {alex.place ? <AlexStart alex={alex} block={false} /> : <AlexBuy alex={alex} />}
                    </div>
                </section>
            )}
        </div>
    );
}
