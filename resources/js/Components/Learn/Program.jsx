import { Link } from '@inertiajs/react';

import { t } from '@/i18n';

export const TYPE_LABEL = {
    video_link: 'Vídeo', video_upload: 'Vídeo', avatar: 'Aula com avatar IA', document: 'Documento', text: 'Texto', quiz: 'Teste', live: 'Ao vivo',
};

// Programa do curso na página do curso: módulos e aulas com o estado (✓ concluída, ▶ atual, 🔒 só para inscritos).
export default function Program({ slug, program }) {
    return (
        <div className="flex flex-col gap-1">
            {program.map((m, mi) => (
                <div key={mi} className={mi ? 'border-t border-line pt-3' : ''}>
                    <h3 className="mb-1.5 flex gap-2.5 font-display text-base font-semibold">
                        <span className="font-mono text-[12px] font-bold text-accent-ink">{String(mi + 1).padStart(2, '0')}</span>
                        {m.title}
                    </h3>
                    {m.lessons.map((l) => {
                        const locked = l.status === 'locked';
                        const row = (
                            <>
                                <span className={`rounded-full flex h-[26px] w-[26px] flex-none items-center justify-center font-mono text-[11px] font-bold ${
                                    l.status === 'done' ? 'bg-success text-white' : l.current ? 'bg-accent text-on-accent' : 'bg-surface2 text-muted'
                                }`} aria-hidden="true">
                                    {l.status === 'done' ? '✓' : locked ? '🔒' : l.current ? '▶' : ''}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate">{l.title}</span>
                                    <small className="text-xs text-muted">{t(TYPE_LABEL[l.type] ?? l.type)}{l.sample ? t(' · amostra grátis') : ''}</small>
                                </span>
                                {l.minutes > 0 && <span className="font-mono text-[11px] text-muted">{l.minutes} min</span>}
                            </>
                        );
                        const cls = `flex items-center gap-2.5 px-2 py-2 text-sm ${l.current ? 'bg-accent/15' : ''}`;
                        return locked ? (
                            <div key={l.ulid} className={`${cls} cursor-not-allowed text-muted`} title={t('Inscreve-te no curso para abrir esta aula')} aria-disabled="true">
                                <span className="sr-only">{t('Só para inscritos:')}{' '}</span>{row}
                            </div>
                        ) : (
                            <Link key={l.ulid} href={`/plataforma/cursos/${slug}/aulas/${l.ulid}`} preserveScroll={false}
                                className={`${cls} hover:bg-page`} aria-current={l.current ? 'page' : undefined}>
                                {l.status === 'done' && <span className="sr-only">{t('Concluída:')}{' '}</span>}
                                {row}
                            </Link>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}
