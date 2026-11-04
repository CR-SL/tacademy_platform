import { Link } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { IconCheck, IconLock, IconX } from '@/Components/Learn/LessonIcons';

const LOCKED_TIP = 'Inscreve-te no curso para abrir esta aula';
const modPct = (m) => Math.round(m.lessons.filter((l) => l.status === 'done').length / m.lessons.length * 100);
const lessonPct = (l, currentPct) => (l.status === 'done' ? 100 : l.current ? currentPct : 0);

// Computador: lista dos módulos que abre ao lado do palco. Abre um módulo de cada vez; fechada, é só a linha do progresso do curso.
export function ModulesRail({ open, slug, program, percent, currentPct }) {
    const current = program.findIndex((m) => m.lessons.some((l) => l.current));
    const [shown, setShown] = useState(current);

    return (
        <aside className={`al-rail ${open ? 'open' : ''}`} aria-label="Módulos do curso">
            <div className="al-rail-line" style={{ height: `${percent}%` }} />
            <div className="al-rail-in" inert={open ? undefined : ''}>
                {program.map((m, mi) => {
                    const on = shown === mi;
                    const pct = modPct(m);
                    return (
                        <div key={mi} className={`al-mod ${on ? 'on' : ''}`}>
                            <button type="button" className="al-mod-b" aria-expanded={on} onClick={() => setShown(on ? null : mi)}>
                                <span>{mi + 1}.</span><span className="tt">{m.title}</span>
                                {pct === 100 && <span className="ck"><IconCheck /></span>}
                            </button>
                            <div className="al-mod-bar"><i style={{ width: `${pct}%` }} /></div>
                            {on && m.lessons.map((l, li) => {
                                const locked = l.status === 'locked';
                                const body = (
                                    <>
                                        <span className="top">
                                            <span>{mi + 1}.{li + 1}</span><span className="sp" />
                                            {l.status === 'done' ? <IconCheck /> : locked ? <IconLock /> : l.current ? <span className="dot" /> : null}
                                            {l.minutes > 0 && <span>{l.minutes} min</span>}
                                        </span>
                                        <span className="tl">{l.title}</span>
                                        <span className="ln"><i style={{ width: `${lessonPct(l, currentPct)}%` }} /></span>
                                    </>
                                );
                                const cls = `al-les ${l.current ? 'cur' : ''}`;
                                return locked
                                    ? <div key={l.ulid} className={`${cls} locked`} title={LOCKED_TIP} aria-disabled="true">{body}</div>
                                    : <Link key={l.ulid} className={cls} href={`/plataforma/cursos/${slug}/aulas/${l.ulid}`} aria-current={l.current ? 'page' : undefined}>{body}</Link>;
                            })}
                        </div>
                    );
                })}
            </div>
        </aside>
    );
}

// Telemóvel: faixa com os módulos na barra de baixo
export function ModulesStrip({ program, sheet, onPick }) {
    const box = useRef(null);
    const current = program.findIndex((m) => m.lessons.some((l) => l.current));
    useEffect(() => {
        const s = box.current;
        const c = s?.querySelector('.al-cell.on');
        if (c) s.scrollLeft = c.offsetLeft - (s.clientWidth - c.offsetWidth) / 2; // sem scrollIntoView, que arrasta a página
    }, [current]);

    return (
        <div className="al-strip" ref={box}>
            {program.map((m, mi) => (
                <button type="button" key={mi} className={`al-cell ${mi === current ? 'on' : ''}`} aria-expanded={sheet === mi} onClick={() => onPick(sheet === mi ? null : mi)}>
                    <i style={{ width: `${modPct(m)}%` }} /><span>{mi + 1}. {m.title}</span>
                </button>
            ))}
        </div>
    );
}

// Telemóvel: aulas do módulo escolhido, por cima dos painéis
export function ModuleSheet({ slug, module: m, index, currentPct, onClose }) {
    return (
        <div className="al-sheet">
            <div className="al-sheet-h">
                <span>{index + 1}</span><span>{m.title}</span>
                <button type="button" onClick={onClose} aria-label="Fechar"><IconX /></button>
            </div>
            <div className="al-sheet-b">
                {m.lessons.map((l, li) => {
                    const locked = l.status === 'locked';
                    const body = (
                        <>
                            <span className="num">{index + 1}.{li + 1}</span><span>{l.title}</span>
                            <small>{l.status === 'done' ? 'Concluída' : locked ? 'Só para inscritos' : l.current ? 'A decorrer' : l.minutes > 0 ? `${l.minutes} min` : ''}</small>
                            <span className="ln"><i style={{ width: `${lessonPct(l, currentPct)}%` }} /></span>
                        </>
                    );
                    const cls = `al-s-les ${l.current ? 'cur' : ''}`;
                    return locked
                        ? <div key={l.ulid} className={`${cls} locked`} aria-disabled="true">{body}</div>
                        : <Link key={l.ulid} className={cls} href={`/plataforma/cursos/${slug}/aulas/${l.ulid}`} aria-current={l.current ? 'page' : undefined}>{body}</Link>;
                })}
            </div>
        </div>
    );
}
