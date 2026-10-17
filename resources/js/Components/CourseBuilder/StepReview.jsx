import { Panel } from './ui';
import { formatEuro, formatMinutes, levelLabels } from './format';
import { checklist, lessonCount, totalMinutes } from './model';

// Passo 4 · Rever e publicar: o cartão do catálogo e o que ainda falta.
export default function StepReview({ c, categories, shortMax, goTo, onPublish, onUnpublish, publishing, error }) {
    const items = checklist(c, shortMax);
    const ready = items.every((i) => i[2]);
    const area = categories.find((x) => x.id === c.category_id)?.name;
    const ai = c.modules.some((m) => m.lessons.some((l) => l.type === 'avatar'));
    const published = c.status === 'published';

    return (
        <Panel
            title={published ? 'Curso publicado' : 'Rever e publicar'}
            sub={published
                ? 'Este curso está no catálogo. As alterações que fizeres ficam visíveis para os alunos logo que são guardadas.'
                : 'Assim fica o cartão no catálogo. Ao publicar, o curso fica logo visível para os alunos.'}
        >
            <div className="grid items-start gap-7 md:grid-cols-[300px_1fr]">
                <div className="relative aspect-[4/5] max-w-[300px] overflow-hidden rounded-[18px] bg-[#222] text-white">
                    {c.thumbnail_url && <img src={c.thumbnail_url} alt="" className="absolute inset-0 h-full w-full object-cover" />}
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent from-35% to-black/85" />
                    <span className="absolute right-3.5 top-3.5 rounded-full bg-accent px-3 py-1 font-display text-[13px] font-bold text-on-accent">
                        {c.is_free ? 'Grátis' : formatEuro(c.price)}
                    </span>
                    <div className="absolute inset-x-[18px] bottom-[18px]">
                        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-white/75">
                            {area ?? 'Área'} · {levelLabels[c.level] ?? 'Nível'}
                        </span>
                        <h3 className="mb-1 mt-1.5 font-display text-[21px] font-semibold leading-[1.15]">{c.title || 'Título do curso'}</h3>
                        <p className="text-[13px] text-white/80">{formatMinutes(totalMinutes(c))} · {lessonCount(c)} aulas</p>
                    </div>
                </div>

                <div>
                    <div className="mb-5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
                        <Fact label="Duração" value={formatMinutes(totalMinutes(c))} />
                        <Fact label="Módulos" value={c.modules.length} />
                        <Fact label="Acesso" value={c.access_months ? `${c.access_months} meses` : 'Vitalício'} />
                        <Fact label="Certificado" value={c.certificate_enabled ? 'Sim' : 'Não'} />
                    </div>
                    {ai && (
                        <p className="mb-4">
                            <span className="ta-cut-8 bg-accent px-2 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-on-accent">✦ Inclui aula com IA</span>
                        </p>
                    )}

                    <span className="font-display text-[13px] font-semibold uppercase tracking-[0.04em]">
                        {published ? 'Verificação' : 'Antes de publicar'}
                    </span>
                    <ul className="mb-5 mt-1">
                        {items.map(([text, step, ok]) => (
                            <li key={text} className={`flex items-center gap-2.5 border-b border-line py-2.5 ${ok ? '' : 'text-muted'}`}>
                                <i className={`flex h-5 w-5 flex-none items-center justify-center text-xs font-bold not-italic ${ok ? 'bg-[#2F9E5B22] text-[#2F9E5B]' : 'bg-live/10 text-live'}`}>
                                    {ok ? '✓' : '!'}
                                </i>
                                {text}
                                {!ok && (
                                    <button type="button" onClick={() => goTo(step)} className="ml-auto font-display text-[13px] font-semibold text-accent-ink hover:text-ink">
                                        Corrigir →
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>

                    {error && <p role="alert" className="mb-3 text-sm text-live">{error}</p>}

                    <div className="flex flex-wrap gap-2.5">
                        {published && c.slug && (
                            <a
                                href={`/cursos?curso=${c.slug}`}
                                target="_blank"
                                rel="noopener"
                                className="ta-cut-8 px-4 py-3 font-display text-sm font-bold uppercase tracking-[0.04em] shadow-[inset_0_0_0_1px_var(--color-line)] hover:bg-page"
                            >
                                Ver no catálogo ↗
                            </a>
                        )}
                        {published ? (
                            <button type="button" onClick={onUnpublish} className="ta-cut-8 px-4 py-3 font-display text-sm font-bold uppercase tracking-[0.04em] text-muted shadow-[inset_0_0_0_1px_var(--color-line)] hover:text-ink">
                                Passar a rascunho
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={onPublish}
                                disabled={!ready || publishing}
                                title={ready ? undefined : 'Completa os pontos em falta'}
                                className="ta-cut-8 ta-press bg-accent px-5 py-3 font-display text-sm font-bold uppercase tracking-[0.04em] text-on-accent disabled:cursor-not-allowed disabled:opacity-45"
                            >
                                {publishing ? 'A publicar…' : 'Publicar curso ▶'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </Panel>
    );
}

function Fact({ label, value }) {
    return (
        <div className="bg-page p-3">
            <small className="block font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted">{label}</small>
            <b className="font-display text-[17px]">{value}</b>
        </div>
    );
}
