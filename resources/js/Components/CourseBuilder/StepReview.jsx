import { usePage } from '@inertiajs/react';
import { Panel } from './ui';
import { formatEuro, formatMinutes, levelLabels } from './format';
import { checklist, lessonCount, totalMinutes } from './model';

import { t } from '@/i18n';

// Passo 5 · Rever e publicar: o cartão do catálogo e o que ainda falta.
export default function StepReview({ c, categories, shortMax, goTo, onPublish, onUnpublish, publishing, error }) {
    // Sem permissão para publicar (Administração › Permissões), o curso fica em rascunho até alguém o publicar
    const { can } = usePage().props;
    const canPublish = can?.['cursos.publicar'] || can?.['cursos.todos'];
    const items = checklist(c, shortMax);
    const ready = items.every((i) => i[2]);
    const area = categories.find((x) => x.id === c.category_id)?.name;
    const ai = c.modules.some((m) => m.lessons.some((l) => l.type === 'avatar'));
    const published = c.status === 'published';

    return (
        <Panel
            title={published ? t('Curso publicado') : t('Rever e publicar')}
            sub={published
                ? t('Este curso está no catálogo. As alterações que fizeres ficam visíveis para os alunos logo que são guardadas.')
                : t('Assim fica o cartão no catálogo. Ao publicar, o curso fica logo visível para os alunos.')}
        >
            <div className="grid items-start gap-7 md:grid-cols-[300px_1fr]">
                <div className="relative aspect-[4/5] max-w-[300px] overflow-hidden bg-carbon text-white">
                    {c.thumbnail_url && <img src={c.thumbnail_url} alt="" className="absolute inset-0 h-full w-full object-cover" />}
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent from-35% to-black/85" />
                    <span className="absolute right-3.5 top-3.5 rounded-full bg-accent px-3 py-1 font-display text-[13px] font-bold text-on-accent">
                        {c.is_free ? t('Grátis') : formatEuro(c.price)}
                    </span>
                    <div className="absolute inset-x-[18px] bottom-[18px]">
                        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-white/75">
                            {area ?? t('Área')} · {levelLabels[c.level] ?? t('Nível')}
                        </span>
                        <h3 className="mb-1 mt-1.5 font-display text-[21px] font-semibold leading-[1.15]">{c.title || t('Título do curso')}</h3>
                        <p className="text-[13px] text-white/80">{formatMinutes(totalMinutes(c))} · {t(':n aulas', { n: lessonCount(c) })}</p>
                    </div>
                </div>

                <div>
                    <div className="mb-5 grid grid-cols-2 gap-2.5 lg:grid-cols-5">
                        <Fact label={t('Duração')} value={formatMinutes(totalMinutes(c))} />
                        <Fact label={t('Módulos')} value={c.modules.length} />
                        <Fact label={t('Acesso')} value={c.access_months ? t(':n meses', { n: c.access_months }) : t('Vitalício')} />
                        <Fact label={t('Prazo')} value={c.deadline_days ? (c.deadline_days === 180 ? t('6 meses') : t(':n dias', { n: c.deadline_days })) : t('Sem prazo')} />
                        <Fact label={t('Certificado')} value={c.certificate_enabled ? (c.requires_attendance ? 'Sim · com presença' : 'Sim') : 'Não'} />
                    </div>
                    {ai && (
                        <p className="mb-4">
                            <span className="rounded-full bg-accent px-2 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-on-accent">{t('✦ Inclui aula com IA')}</span>
                        </p>
                    )}

                    <span className="font-display text-[13px] font-semibold uppercase tracking-[0.04em]">
                        {published ? t('Verificação') : t('Antes de publicar')}
                    </span>
                    <ul className="mb-5 mt-1">
                        {items.map(([text, step, ok]) => (
                            <li key={text} className={`flex items-center gap-2.5 border-b border-line py-2.5 ${ok ? '' : 'text-muted'}`}>
                                <i className={`flex h-5 w-5 flex-none items-center justify-center text-xs font-bold not-italic ${ok ? 'bg-success/10 text-success-ink' : 'bg-live/10 text-live-ink'}`}>
                                    {ok ? '✓' : '!'}
                                </i>
                                {text}
                                {!ok && (
                                    <button type="button" onClick={() => goTo(step)} className="ml-auto font-display text-[13px] font-semibold text-accent-ink hover:text-ink">
                                        {t('Corrigir →')}
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>

                    {error && <p role="alert" className="mb-3 text-sm text-live-ink">{error}</p>}

                    <div className="flex flex-wrap gap-2.5">
                        {c.ulid && c.slug && (
                            <a
                                href={`/plataforma/cursos/${c.slug}`}
                                target="_blank"
                                rel="noopener"
                                className="ui-btn ui-btn-line"
                            >
                                {t('Pré-visualizar como aluno')}
                            </a>
                        )}
                        {published ? (
                            <button type="button" onClick={onUnpublish} className="ui-btn ui-btn-soft">
                                {t('Passar a rascunho')}
                            </button>
                        ) : !canPublish ? (
                            <p className="text-[13.5px] text-muted">{t('O teu perfil não publica cursos. Quando estiver pronto, pede a um admin para o publicar.')}</p>
                        ) : (
                            <button
                                type="button"
                                onClick={onPublish}
                                disabled={!ready || publishing}
                                title={ready ? undefined : t('Completa os pontos em falta')}
                                className="ui-btn ui-btn-accent"
                            >
                                {publishing ? t('A publicar…') : t('Publicar curso ▶')}
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
