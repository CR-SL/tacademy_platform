import { Link } from '@inertiajs/react';
import { useEffect, useState } from 'react';

export const TYPE_LABEL = {
    video_link: 'Vídeo', video_upload: 'Vídeo', avatar: 'Aula com avatar IA', document: 'Documento', text: 'Texto', quiz: 'Teste', live: 'Ao vivo',
};

// Programa do curso: módulos e aulas com o estado (✓ concluída, ▶ atual, 🔒 bloqueada).
// Na aula (compact) os módulos abrem e fecham; começa aberto só o da aula atual.
export default function Program({ slug, program, compact = false }) {
    const currentModule = program.findIndex((m) => m.lessons.some((l) => l.current));
    const [open, setOpen] = useState(() => new Set([currentModule]));
    // Ao passar para uma aula de outro módulo, esse módulo abre (os que o aluno abriu ficam abertos)
    useEffect(() => { setOpen((s) => (s.has(currentModule) ? s : new Set(s).add(currentModule))); }, [currentModule]);
    const toggle = (mi) => setOpen((s) => {
        const n = new Set(s);
        n.has(mi) ? n.delete(mi) : n.add(mi);
        return n;
    });

    return (
        <div className="flex flex-col gap-1">
            {program.map((m, mi) => {
                const shown = !compact || open.has(mi);
                const doneCount = m.lessons.filter((l) => l.status === 'done').length;
                const num = <span className="font-mono text-[12px] font-bold text-accent-ink">{String(mi + 1).padStart(2, '0')}</span>;
                return (
                <div key={mi} className={mi ? `border-t border-line ${compact ? 'pt-1' : 'pt-3'}` : ''}>
                    {compact ? (
                        <button type="button" onClick={() => toggle(mi)} aria-expanded={shown}
                            className="flex w-full items-start gap-2.5 px-1 py-2 text-left font-display text-sm font-semibold hover:text-accent-ink">
                            {num}
                            <span className="min-w-0 flex-1">
                                {m.title}
                                <small className="block font-mono text-[11px] font-normal text-muted">{doneCount}/{m.lessons.length} aulas</small>
                            </span>
                            <svg className={`mt-1 h-3.5 w-3.5 flex-none text-muted transition-transform duration-200 ${shown ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
                        </button>
                    ) : (
                        <h3 className="mb-1.5 flex gap-2.5 font-display text-base font-semibold">{num}{m.title}</h3>
                    )}
                    {shown && m.lessons.map((l) => {
                        const locked = l.status === 'locked';
                        const row = (
                            <>
                                <span className={`ta-cut-8 flex h-[26px] w-[26px] flex-none items-center justify-center font-mono text-[11px] font-bold ${
                                    l.status === 'done' ? 'bg-[#2F9E5B] text-white' : l.current ? 'bg-accent text-on-accent' : 'bg-surface2 text-muted'
                                }`} aria-hidden="true">
                                    {l.status === 'done' ? '✓' : locked ? '🔒' : l.current ? '▶' : ''}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate">{l.title}</span>
                                    <small className="text-xs text-muted">{TYPE_LABEL[l.type] ?? l.type}{l.sample ? ' · amostra grátis' : ''}</small>
                                </span>
                                {l.minutes > 0 && <span className="font-mono text-[11px] text-muted">{l.minutes} min</span>}
                            </>
                        );
                        const cls = `flex items-center gap-2.5 px-2 py-2 text-sm ${l.current ? 'bg-accent/15' : ''}`;
                        return locked ? (
                            <div key={l.ulid} className={`${cls} cursor-not-allowed text-muted`} title="Conclui as aulas anteriores para desbloquear" aria-disabled="true">
                                <span className="sr-only">Bloqueada: </span>{row}
                            </div>
                        ) : (
                            <Link key={l.ulid} href={`/plataforma/cursos/${slug}/aulas/${l.ulid}`} preserveScroll={false}
                                className={`${cls} hover:bg-page`} aria-current={l.current ? 'page' : undefined}>
                                {l.status === 'done' && <span className="sr-only">Concluída: </span>}
                                {row}
                            </Link>
                        );
                    })}
                </div>
                );
            })}
        </div>
    );
}
