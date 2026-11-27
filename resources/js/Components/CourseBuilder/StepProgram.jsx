import { usePage } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { useConfirm } from '@/Components/ui';
import { AddLink, Field, IconButton, inputCls, Panel } from './ui';
import { formatBytes, formatMinutes, isHttpUrl, isUploadedVideo, linkInfo } from './format';
import { blankActivity, blankLessonData, lessonMissing, newKey, totalMinutes } from './model';
import { ExerciseEditor, RoleplayEditor, TestEditor } from './Activities';

import { t } from '@/i18n';

// O que uma aula pode ter: o formador liga cada parte (2026-11-25). [chave, nome, dica curta, ícone da linha]
export const PARTS = [
    ['video', 'Vídeo', 'Carregar ou colar link', { short: '▶', cls: 'bg-ink text-on-ink' }],
    ['material', 'Material didático', 'PDF, fichas, esquemas', { short: 'PDF', cls: 'bg-surface2' }],
    ['notas', 'Notas', 'Texto que o aluno lê', { short: 'Aa', cls: 'bg-surface2' }],
];
// Tipos de atividade de cada módulo (fase 2, 2026-11-27)
export const KINDS = {
    aula: { label: 'Aula', short: '▶', cls: 'bg-ink text-on-ink' },
    teste: { label: 'Teste', short: '?', cls: 'bg-[#FFE9A8] text-[#5A4000]' },
    exercicio: { label: 'Exercício', short: 'Ex', cls: 'bg-surface2' },
    roleplay: { label: 'Roleplay', short: 'RP', cls: 'bg-[#2B2B2B] text-accent' },
};

export const blankLesson = blankLessonData;
// key/id/option_ids: o servidor atualiza pelo id, para não estragar as tentativas dos alunos

// Passo 2 · Programa: módulos e aulas, por ordem.
export default function StepProgram({ c, update, upload, openKey, setOpenKey, canAlex = true }) {
    const lessons = c.modules.reduce((a, m) => a + m.lessons.length, 0);
    const move = (arr, i, d) => { const j = i + d; if (j >= 0 && j < arr.length) [arr[i], arr[j]] = [arr[j], arr[i]]; };
    const [confirm, confirmDialog] = useConfirm();

    // O que falta em cada aula (o guia mostra-o por cima do programa)
    const all = c.modules.flatMap((m, mi) => m.lessons.map((l, li) => ({ n: `${mi + 1}.${li + 1}`, l, miss: lessonMissing(l) })));
    const ready = all.filter((x) => !x.miss.length).length;
    const todo = all.filter((x) => x.miss.length);

    return (
        <Panel title={t('Programa')} sub={t('Cada módulo é uma lista de atividades (aulas, testes, exercícios e roleplays), pela ordem que o aluno as faz.')}>
            <div className="mb-4 flex flex-wrap items-center gap-5 font-mono text-xs uppercase tracking-[0.06em] text-muted">
                <span><b className="mr-1 font-display text-base text-ink">{c.modules.length}</b>{t('Módulos')}</span>
                <span><b className="mr-1 font-display text-base text-ink">{lessons}</b>{t('Aulas')}</span>
                <span><b className="mr-1 font-display text-base text-ink">{formatMinutes(totalMinutes(c))}</b>{t('Duração total')}</span>
            </div>

            {all.length > 0 && (
                <div data-guide="ready" className="mb-4 bg-page px-4 py-3">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <b className="font-display text-sm">{t(':ready de :total aulas prontas', { ready, total: all.length })}</b>
                        <div className="h-1.5 min-w-[120px] flex-1 bg-track" aria-hidden="true"><div className="h-full bg-accent transition-[width]" style={{ width: `${(ready / all.length) * 100}%` }} /></div>
                    </div>
                    {todo.length > 0 && (
                        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px]">
                            {todo.slice(0, 4).map((x) => (
                                <li key={x.l.key}>
                                    <button type="button" className="text-muted hover:text-ink hover:underline" onClick={() => setOpenKey(x.l.key)}>
                                        {t('Aula :n: falta :what', { n: x.n, what: x.miss[0] })}
                                    </button>
                                </li>
                            ))}
                            {todo.length > 4 && <li className="text-muted">{t('e mais :n', { n: todo.length - 4 })}</li>}
                        </ul>
                    )}
                </div>
            )}

            {c.modules.map((m, mi) => (
                <div key={m.key} className="mb-3.5 border border-line bg-surface">
                    <div className="flex flex-wrap items-center gap-3 bg-page px-4 py-3">
                        <span className="font-mono text-[13px] font-bold text-accent-ink">{String(mi + 1).padStart(2, '0')}</span>
                        <input
                            className="min-w-0 flex-1 border-b border-transparent bg-transparent py-1 font-display text-[17px] font-semibold focus:border-accent focus:outline-none"
                            value={m.title}
                            maxLength={200}
                            placeholder={t('Título do módulo')}
                            aria-label={t('Título do módulo :v1', { v1: mi + 1 })}
                            onChange={(e) => update((d) => { d.modules[mi].title = e.target.value; })}
                        />
                        <div className="flex gap-1.5">
                            <IconButton label={t('Subir módulo')} disabled={mi === 0} onClick={() => update((d) => move(d.modules, mi, -1))}>↑</IconButton>
                            <IconButton label={t('Descer módulo')} disabled={mi === c.modules.length - 1} onClick={() => update((d) => move(d.modules, mi, 1))}>↓</IconButton>
                            <IconButton
                                label={t('Apagar módulo')}
                                danger
                                onClick={async () => {
                                    if (m.lessons.length && !(await confirm({
                                        title: t('Apagar o módulo “:v1”?', { v1: m.title || t('sem título') }),
                                        body: m.lessons.length === 1 ? t('A aula deste módulo também é apagada.') : t('As :length aulas deste módulo também são apagadas.', { length: m.lessons.length }),
                                        action: t('Apagar o módulo'),
                                        danger: true,
                                    }))) return;
                                    update((d) => {
                                        d.modules.splice(mi, 1);
                                        if (!d.modules.length) d.modules.push({ key: newKey(), id: null, title: '', description: '', lessons: [] });
                                    });
                                }}
                            >✕</IconButton>
                        </div>
                    </div>
                    <div className="px-4 pt-2.5">
                        <input
                            className="w-full border-b border-dashed border-line bg-transparent py-1 text-sm text-muted focus:border-accent focus:text-ink focus:outline-none"
                            value={m.description}
                            maxLength={1000}
                            placeholder={t('Descrição do módulo (opcional)')}
                            aria-label={t('Descrição do módulo :v1', { v1: mi + 1 })}
                            onChange={(e) => update((d) => { d.modules[mi].description = e.target.value; })}
                        />
                    </div>
                    <div className="flex flex-col gap-2 p-4 pt-2.5">
                        {m.lessons.map((l, li) => (
                            <LessonRow
                                key={l.key}
                                l={l}
                                index={li}
                                count={m.lessons.length}
                                open={openKey === l.key}
                                onToggle={() => setOpenKey(openKey === l.key ? null : l.key)}
                                // Pela chave da aula, não pela posição: um vídeo que acaba de carregar minutos depois
                                // vai para a aula certa mesmo que entretanto se tenham apagado ou movido aulas
                                set={(fn) => update((d) => {
                                    const target = d.modules.flatMap((x) => x.lessons).find((x) => x.key === l.key);
                                    if (target) fn(target);
                                })}
                                onMove={(dir) => update((d) => move(d.modules[mi].lessons, li, dir))}
                                onDelete={async () => {
                                    if (!(await confirm({ title: t('Apagar a aula “:v1”?', { v1: l.title || t('sem título') }), action: t('Apagar a aula'), danger: true }))) return;
                                    update((d) => {
                                        d.modules[mi].lessons.splice(li, 1);
                                    });
                                }}
                                upload={upload}
                                confirm={confirm}
                                c={c}
                                canAlex={canAlex}
                                guide={mi === 0 && li === 0}
                            />
                        ))}
                        <div className="flex flex-wrap gap-1.5" data-guide={mi === 0 ? 'add-activity' : undefined}>
                            {Object.entries(KINDS).map(([k, kx]) => (
                                <button
                                    key={k}
                                    type="button"
                                    className="inline-flex items-center gap-1.5 px-3 py-2 font-display text-xs font-bold uppercase tracking-[0.04em] shadow-[inset_0_0_0_1px_var(--color-line)] hover:bg-page"
                                    onClick={() => {
                                        const l = blankActivity(k);
                                        update((d) => { d.modules[mi].lessons.push(l); });
                                        setOpenKey(l.key);
                                    }}
                                >
                                    <i aria-hidden="true" className={`grid h-[18px] w-[18px] place-items-center rounded-full text-[9px] not-italic ${kx.cls}`}>{kx.short}</i>
                                    {t('+ :kind', { kind: t(kx.label) })}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            ))}

            {c.modules.length < 50 && (
                <button
                    type="button"
                    className="ui-btn ui-btn-line"
                    onClick={() => update((d) => { d.modules.push({ key: newKey(), id: null, title: '', description: '', lessons: [] }); })}
                >
                    {t('+ Adicionar módulo')}
                </button>
            )}
            {confirmDialog}
        </Panel>
    );
}

function LessonRow({ l, index, count, open, onToggle, set, onMove, onDelete, upload, confirm, c, canAlex, guide }) {
    const parts = l.parts ?? [];
    const kind = KINDS[l.kind] ? l.kind : 'aula';
    const icon = KINDS[kind];
    const miss = lessonMissing(l);
    const n = (l.quiz ?? []).length;
    const summary = {
        aula: PARTS.filter(([k]) => parts.includes(k)).map(([, label]) => t(label)).join(' · ') || t('Nada escolhido'),
        teste: l.evaluation === 'avatar' ? t('Teste com avatar') : t('Teste escrito · :n perguntas', { n }),
        exercicio: l.evaluation === 'quiz' ? t('Exercício · :n perguntas · sem nota', { n }) : t('Exercício prático · sem nota'),
        roleplay: [t('Roleplay'), l.roleplay_role, l.graded ? t('com nota') : t('sem nota')].filter(Boolean).join(' · '),
    }[kind];

    return (
        <div className="border border-line bg-surface">
            <div data-guide={guide ? 'lesson-row' : undefined} className="grid grid-cols-[34px_1fr_auto] items-center gap-2.5 px-3 py-2.5 sm:grid-cols-[34px_1fr_auto_auto]">
                <button type="button" onClick={onToggle} aria-expanded={open} aria-label={open ? t('Fechar a aula :n', { n: index + 1 }) : t('Abrir a aula :n', { n: index + 1 })}
                    className={`rounded-full flex h-[34px] w-[34px] items-center justify-center font-mono text-[11px] font-bold ${icon.cls}`}>
                    {icon.short}
                </button>
                <button type="button" onClick={onToggle} className="min-w-0 text-left">
                    <span className={`block truncate ${l.title ? 'font-medium' : 'italic text-muted'}`}>{l.title || t(':kind sem título', { kind: t(icon.label) })}</span>
                    <small className="block text-xs text-muted">{summary}{l.minutes ? t(' · :minutes min', { minutes: l.minutes }) : ''}
                        {activeUploads.lessons[l.key] > 0 && <b className="font-semibold text-accent-ink">{t(' · a carregar ficheiro…')}</b>}</small>
                </button>
                <span className={`hidden font-mono text-[11px] font-semibold uppercase tracking-[0.04em] sm:inline ${miss.length ? 'text-live-ink' : 'text-success-ink'}`}>
                    {miss.length ? t('Falta: :what', { what: miss[0] }) : <><span aria-hidden="true">✓ </span>{t('Completa')}</>}
                </span>
                <span className="flex gap-1">
                    <IconButton label={t('Subir aula')} className="hidden sm:inline-flex" disabled={index === 0} onClick={() => onMove(-1)}>↑</IconButton>
                    <IconButton label={t('Descer aula')} className="hidden sm:inline-flex" disabled={index === count - 1} onClick={() => onMove(1)}>↓</IconButton>
                    <IconButton label={t('Apagar aula')} danger onClick={onDelete}>✕</IconButton>
                </span>
            </div>
            {open && <LessonEditor l={l} set={set} upload={upload} confirm={confirm} c={c} canAlex={canAlex} />}
        </div>
    );
}

// Dica curta em cada bloco do editor (o "?" do guia)
function Hint({ children }) {
    return (
        <p className="mb-2.5 mt-1 flex gap-2 text-[12.5px] text-muted">
            <span aria-hidden="true" className="mt-px grid h-[17px] w-[17px] flex-none place-items-center rounded-full bg-ink font-display text-[11px] font-bold text-on-ink">?</span>
            <span>{children}</span>
        </p>
    );
}

function Block({ title, hint, onRemove, children }) {
    return (
        <div className="mb-3 border-l-[3px] border-accent bg-page px-3.5 pb-3.5 pt-3">
            <div className="flex items-center gap-2">
                <b className="font-display text-sm font-bold">{title}</b>
                {onRemove && (
                    <button type="button" onClick={onRemove} className="ml-auto font-display text-[12.5px] font-semibold text-muted hover:text-live-ink">{t('Tirar')}</button>
                )}
            </div>
            {hint && <Hint>{hint}</Hint>}
            {children}
        </div>
    );
}

// O que se perde ao desligar uma parte (pergunta antes, para não apagar um vídeo carregado sem querer)
const filled = {
    video: (l) => !!l.url.trim() || (l.checks ?? []).length > 0,
    material: (l) => l.attachments.length > 0,
    notas: (l) => !!l.body.trim(),
};

function LessonEditor({ l, set, upload, confirm, c, canAlex }) {
    const id = `l-${l.key}`;
    const info = linkInfo(l.url);
    const parts = l.parts ?? [];

    const togglePart = async (k) => {
        if (parts.includes(k)) {
            const label = t(PARTS.find(([p]) => p === k)[1]);
            if (filled[k](l) && !(await confirm({
                title: t('Tirar “:part” desta aula?', { part: label }),
                body: t('O que puseste nesta parte deixa de aparecer ao aluno e é apagado quando o curso for guardado.'),
                action: t('Tirar'),
                danger: true,
            }))) return;
            set((x) => { x.parts = (x.parts ?? []).filter((p) => p !== k); });
        } else {
            // Mantém a ordem do editor: vídeo, material, notas, avatar
            set((x) => { x.parts = PARTS.map(([p]) => p).filter((p) => p === k || (x.parts ?? []).includes(p)); });
        }
    };
    return (
        <div className="border-t border-line px-3.5 pb-4 sm:pl-[66px]">
            <div className="mt-3 grid gap-x-4 sm:grid-cols-[1fr_150px]">
                <Field label={t('Título')} id={`${id}-t`} required className="mb-5">
                    <input id={`${id}-t`} className={inputCls} value={l.title} maxLength={200} placeholder={t('Ex.: Introdução ao sistema')}
                        onChange={(e) => set((x) => { x.title = e.target.value; })} />
                </Field>
                <Field label={t('Duração (min)')} id={`${id}-m`} className="mb-5">
                    <input id={`${id}-m`} type="number" min="0" max="600" className={inputCls} value={l.minutes} placeholder="10"
                        onChange={(e) => set((x) => { x.minutes = e.target.value === '' ? '' : Math.max(0, Math.min(600, parseInt(e.target.value, 10) || 0)); })} />
                </Field>
            </div>

            {l.kind === 'teste' && <TestEditor l={l} set={set} canAlex={canAlex} id={id} />}
            {l.kind === 'exercicio' && <ExerciseEditor l={l} set={set} id={id} attachments={<Attachments l={l} set={set} upload={upload} />} />}
            {l.kind === 'roleplay' && <RoleplayEditor l={l} set={set} canAlex={canAlex} id={id} />}
            {(l.kind ?? 'aula') === 'aula' && <>
            <span className="mb-1.5 block font-display text-[13px] font-semibold uppercase tracking-[0.04em]">
                {t('O que tem esta aula?')}
                <span className="ml-1 font-sans text-xs font-normal normal-case tracking-normal text-muted">{t('Liga só o que precisas. Podes ligar várias.')}</span>
            </span>
            <div data-guide="parts" className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3" role="group" aria-label={t('O que tem esta aula')}>
                {PARTS.map(([k, label, hint]) => {
                    const on = parts.includes(k);
                    return (
                        <button key={k} type="button" aria-pressed={on} onClick={() => togglePart(k)}
                            className={`flex min-h-[64px] items-start gap-2.5 border p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${on ? 'border-ink bg-accent/10' : 'border-line bg-surface hover:border-muted'}`}>
                            <span aria-hidden="true" className={`relative mt-0.5 h-5 w-[34px] flex-none rounded-full transition-colors ${on ? 'bg-accent' : 'bg-track'}`}>
                                <span className={`absolute left-[3px] top-[3px] h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-[14px]' : ''}`} />
                            </span>
                            <span className="min-w-0">
                                <b className="block font-display text-sm font-bold">{t(label)}</b>
                                <small className="block text-xs leading-snug text-muted">{t(hint)}</small>
                            </span>
                        </button>
                    );
                })}
            </div>

            {parts.includes('video') && (
                <Block title={t('Vídeo')} onRemove={() => togglePart('video')}
                    hint={t('A aula fica concluída quando o aluno vê 90% do vídeo. Indica os minutos acima.')}>
                    <div className="flex flex-col gap-1.5">
                        <VideoUpload l={l} set={set} />
                        {!isUploadedVideo(l.url) && (
                            <input id={`${id}-u`} aria-label={t('Link do vídeo')} className={inputCls} value={l.url} maxLength={500}
                                placeholder="https://vimeo.com/… ou https://www.youtube.com/watch?v=…"
                                onChange={(e) => set((x) => { x.url = e.target.value; })} />
                        )}
                        {isUploadedVideo(l.url) ? null : info ? (
                            <div className="mt-1 flex flex-wrap items-center gap-3 bg-surface p-2.5">
                                {info.thumb && <img src={info.thumb} alt="" className="aspect-video w-[120px] object-cover" />}
                                <span className="bg-ink px-2 py-0.5 font-mono text-[11px] font-semibold text-on-ink">{info.tag}</span>
                                <span className="font-mono text-[11px] font-semibold uppercase text-success-ink"><span aria-hidden="true">✓ </span>{t('Link válido')}</span>
                                {isHttpUrl(l.url) && (
                                    <a href={l.url.trim()} target="_blank" rel="noopener noreferrer" className="ml-auto font-display text-[13px] font-semibold text-accent-ink hover:text-ink">
                                        {t('Abrir ↗')}
                                    </a>
                                )}
                            </div>
                        ) : l.url ? (
                            <span className="text-[13px] text-live-ink">{t('O link tem de começar por https://')}</span>
                        ) : null}
                    </div>
                    <div className="mt-4"><ChecksEditor l={l} set={set} /></div>
                </Block>
            )}

            {parts.includes('material') && (
                <Block title={t('Material didático')} onRemove={() => togglePart('material')}
                    hint={t('O aluno vê e descarrega ao lado da aula. Põe aqui as fichas técnicas e os esquemas.')}>
                    <Attachments l={l} set={set} upload={upload} bare />
                </Block>
            )}

            {parts.includes('notas') && (
                <Block title={t('Notas')} onRemove={() => togglePart('notas')}
                    hint={t('Texto que o aluno lê durante a aula: avisos, resumos, passos a seguir.')}>
                    <textarea id={`${id}-b`} aria-label={t('Notas da aula')} rows={5} className={inputCls} value={l.body} placeholder={t('Escreve as notas da aula…')}
                        onChange={(e) => set((x) => { x.body = e.target.value; })} />
                </Block>
            )}

            </>}
        </div>
    );
}

const blankCheck = () => ({ key: newKey(), id: null, question: '', options: ['', '', ''], correct: 0, explanation: '' });

// Perguntas rápidas no fim do vídeo: são opcionais para o aluno e não contam para a nota
function ChecksEditor({ l, set }) {
    const checks = l.checks ?? [];
    return (
        <div className="mb-5 flex flex-col gap-1.5">
            <span className="font-display text-[13px] font-semibold uppercase tracking-[0.04em]">
                {t('Perguntas rápidas')}
                <span className="ml-1 font-sans text-xs font-normal normal-case tracking-normal text-muted">
                    {t('(2 a 3, no fim do vídeo; o aluno responde se quiser e não conta para a nota)')}
                </span>
            </span>
            {checks.map((q, qi) => (
                <div key={qi} className="bg-surface p-3.5">
                    <div className="flex gap-2">
                        <input className={inputCls} value={q.question} maxLength={500} placeholder={t('Pergunta :v1', { v1: qi + 1 })} aria-label={t('Pergunta rápida :v1', { v1: qi + 1 })}
                            onChange={(e) => set((x) => { x.checks[qi].question = e.target.value; })} />
                        <IconButton label={t('Remover pergunta')} danger onClick={() => set((x) => { x.checks.splice(qi, 1); })}>✕</IconButton>
                    </div>
                    {q.options.map((o, oi) => (
                        <div key={oi} className="mt-1.5 flex items-center gap-2">
                            <input className={inputCls} value={o} maxLength={300} placeholder={t('Opção :v1', { v1: oi + 1 })} aria-label={t('Pergunta rápida :v1, opção :v2', { v1: qi + 1, v2: oi + 1 })}
                                onChange={(e) => set((x) => { x.checks[qi].options[oi] = e.target.value; })} />
                            <label className="flex items-center gap-1 whitespace-nowrap text-xs text-muted">
                                <input type="radio" name={`chk-${l.key}-${qi}`} checked={q.correct === oi} className="text-accent focus:ring-ink"
                                    onChange={() => set((x) => { x.checks[qi].correct = oi; })} />
                                {t('certa')}
                            </label>
                        </div>
                    ))}
                    {q.options.length < 4 && <AddLink onClick={() => set((x) => { x.checks[qi].options.push(''); })}>{t('+ Opção')}</AddLink>}
                    <input className={`${inputCls} mt-1.5`} value={q.explanation ?? ''} maxLength={500} placeholder={t('Explicação mostrada depois de responder (opcional)')}
                        aria-label={t('Explicação da pergunta rápida :v1', { v1: qi + 1 })} onChange={(e) => set((x) => { x.checks[qi].explanation = e.target.value; })} />
                </div>
            ))}
            <div className="flex flex-wrap items-center gap-4">
                {checks.length < 5 && (
                    <AddLink onClick={() => set((x) => { x.checks = [...(x.checks ?? []), blankCheck()]; })}>{t('+ Adicionar pergunta rápida')}</AddLink>
                )}
                <button type="button" disabled title={t('Em breve: a IA gera as perguntas a partir do vídeo')}
                    className="cursor-not-allowed py-1.5 font-display text-[13.5px] font-semibold text-muted">
                    {t('✦ Gerar com IA')}{' '}<span className="font-sans text-xs font-normal">{t('(em breve)')}</span>
                </button>
            </div>
        </div>
    );
}

const VIDEO_CHUNK = 1536 * 1024; // igual a CourseBuilder::VIDEO_CHUNK_BYTES

// Duração do vídeo lida no próprio browser, para preencher os minutos da aula
const videoMinutes = (file) => new Promise((resolve) => {
    const v = document.createElement('video');
    const url = URL.createObjectURL(file);
    const done = (m) => { URL.revokeObjectURL(url); resolve(m); };
    v.preload = 'metadata';
    v.onloadedmetadata = () => done(Number.isFinite(v.duration) ? Math.max(1, Math.round(v.duration / 60)) : null);
    v.onerror = () => done(null);
    v.src = url;
});

// Upload do vídeo da aula aos pedaços (com barra de progresso); o endereço fica no link da aula
// Vídeos a carregar neste momento: o editor avisa antes de sair da página (sair perde o envio)
// O envio continua quando se fecha a aula ou se muda de passo (antes parava sem aviso e o ficheiro perdia-se);
// só pára quando se sai do editor (stop). O editor mostra "A carregar…" e os erros (notify).
export const activeUploads = { count: 0, stop: false, lessons: {}, notify: null };
const startUpload = (key) => {
    activeUploads.count++;
    activeUploads.lessons[key] = (activeUploads.lessons[key] ?? 0) + 1;
    activeUploads.notify?.();
};
const endUpload = (key, error = '') => {
    activeUploads.count--;
    activeUploads.lessons[key] = Math.max(0, (activeUploads.lessons[key] ?? 1) - 1);
    activeUploads.notify?.(error);
};

function VideoUpload({ l, set }) {
    const { videoMaxMb = 1024 } = usePage().props;
    const [progress, setProgress] = useState(null);
    const [err, setErr] = useState('');
    const [name, setName] = useState('');
    const cancel = useRef(false);
    const uploaded = isUploadedVideo(l.url);

    const send = async (file) => {
        if (!file) return;
        setErr('');
        if (!/\.(mp4|webm)$/i.test(file.name)) { setErr(t('O vídeo tem de ser MP4 ou WebM. Se for .mov, exporta-o em MP4 (H.264).')); return; }
        if (file.size > videoMaxMb * 1024 * 1024) { setErr(t('O vídeo não pode ter mais de :videoMaxMb MB.', { videoMaxMb })); return; }
        const minutes = await videoMinutes(file);
        const id = crypto.randomUUID();
        const total = Math.ceil(file.size / VIDEO_CHUNK);
        cancel.current = false;
        setName(file.name);
        setProgress(0);
        startUpload(l.key);
        let failed = '';
        try {
            let res;
            for (let i = 0; i < total; i++) {
                if (cancel.current || activeUploads.stop) { setProgress(null); return; }
                const form = new FormData();
                form.append('id', id);
                form.append('index', i);
                form.append('total', total);
                form.append('size', file.size);
                form.append('name', file.name);
                form.append('chunk', file.slice(i * VIDEO_CHUNK, (i + 1) * VIDEO_CHUNK), 'chunk');
                res = await window.axios.post('/formador/videos', form);
                setProgress((i + 1) / total);
            }
            set((x) => {
                x.url = res.data.url;
                if (minutes && !Number(x.minutes)) x.minutes = minutes;
            });
        } catch (e) {
            const d = e.response?.data;
            failed = d?.message && e.response.status !== 500 ? (Object.values(d.errors ?? {})[0]?.[0] ?? d.message) : t('Não foi possível carregar o vídeo. Tenta outra vez.');
            setErr(failed);
        } finally {
            endUpload(l.key, failed && t('Vídeo “:name”: :error', { name: file.name, error: failed }));
            setProgress(null);
        }
    };

    if (progress !== null) {
        return (
            <div className="flex flex-col gap-2 bg-surface p-3">
                <div className="flex items-center gap-3 text-sm">
                    <span className="min-w-0 flex-1 truncate">{t('A carregar')}{' '}<b>{name}</b>…</span>
                    <span className="font-mono text-xs font-semibold">{Math.round(progress * 100)}%</span>
                    <button type="button" onClick={() => { cancel.current = true; }} className="font-display text-[13px] font-semibold text-muted hover:text-live-ink">{t('Cancelar')}</button>
                </div>
                <div className="h-1.5 bg-track"><div className="h-full bg-accent transition-[width]" style={{ width: `${progress * 100}%` }} /></div>
                <p className="text-xs text-muted">{t('Não feches esta página até terminar.')}</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-1.5">
            {uploaded ? (
                <div className="flex flex-wrap items-center gap-3 bg-surface p-2.5">
                    <video src={l.url} preload="metadata" muted className="aspect-video w-[120px] bg-black object-cover" />
                    <span className="bg-ink px-2 py-0.5 font-mono text-[11px] font-semibold uppercase text-on-ink">{t('Vídeo carregado')}</span>
                    <span className="font-mono text-[11px] font-semibold uppercase text-success-ink"><span aria-hidden="true">✓ </span>{t('Leitor T.Academy')}</span>
                    <span className="ml-auto flex gap-3">
                        <label className="cursor-pointer font-display text-[13px] font-semibold text-accent-ink hover:text-ink">
                            {t('Trocar vídeo')}
                            <input type="file" accept="video/mp4,video/webm,.mp4,.webm" className="sr-only" onChange={(e) => { send(e.target.files[0]); e.target.value = ''; }} />
                        </label>
                        <button type="button" onClick={() => set((x) => { x.url = ''; })} className="font-display text-[13px] font-semibold text-muted hover:text-live-ink">{t('Remover')}</button>
                    </span>
                </div>
            ) : (
                <label className="flex cursor-pointer flex-wrap items-center gap-3 border border-dashed border-line bg-surface px-3 py-2.5 text-sm hover:border-muted">
                    <span className="rounded-full bg-ink px-3 py-1.5 font-display text-xs font-bold uppercase tracking-[0.04em] text-on-ink">{t('Carregar vídeo')}</span>
                    <span className="text-muted">{t('MP4 ou WebM, até')}{' '}{videoMaxMb >= 1024 ? `${(videoMaxMb / 1024).toString().replace('.', ',')} GB` : `${videoMaxMb} MB`}{' '}{t('· ou cola um link abaixo')}</span>
                    <input type="file" accept="video/mp4,video/webm,.mp4,.webm" className="sr-only" onChange={(e) => { send(e.target.files[0]); e.target.value = ''; }} />
                </label>
            )}
            {err && <span className="text-xs font-semibold text-live-ink" role="alert">{err}</span>}
        </div>
    );
}

const ATTACH_TYPES = /.(pdf|jpe?g|png|webp|docx?|xlsx?|pptx?|zip)$/i;

// Anexos das aulas: enviados aos pedaços, como os vídeos (sem limite do servidor por pedido, com progresso)
// bare: dentro do bloco "Material didático" (sem título próprio, com a caixa grande para carregar)
function Attachments({ l, set, bare, main = bare }) {
    const { attachmentMaxMb = 100 } = usePage().props;
    const [progress, setProgress] = useState(null); // null = parado; 0..1 = a enviar
    const [name, setName] = useState('');
    const [err, setErr] = useState('');
    const cancel = useRef(false);

    const send = async (file) => {
        if (!file) return;
        setErr('');
        if (!ATTACH_TYPES.test(file.name)) { setErr(t('Este tipo de ficheiro não é aceite. Usa PDF, imagens, Office ou zip.')); return; }
        if (file.size > attachmentMaxMb * 1024 * 1024) { setErr(t('O ficheiro não pode ter mais de :mb MB.', { mb: attachmentMaxMb })); return; }
        const id = crypto.randomUUID();
        const total = Math.max(1, Math.ceil(file.size / VIDEO_CHUNK));
        cancel.current = false;
        setName(file.name);
        setProgress(0);
        startUpload(l.key);
        let failed = '';
        try {
            let res;
            for (let i = 0; i < total; i++) {
                if (cancel.current || activeUploads.stop) return;
                const form = new FormData();
                form.append('id', id);
                form.append('index', i);
                form.append('total', total);
                form.append('size', file.size);
                form.append('name', file.name);
                form.append('chunk', file.slice(i * VIDEO_CHUNK, (i + 1) * VIDEO_CHUNK), 'chunk');
                res = await window.axios.post('/formador/anexos', form);
                setProgress((i + 1) / total);
            }
            const r = res.data;
            set((x) => { x.attachments.push({ name: r.name, path: r.path, size: r.size, url: r.url }); });
        } catch (e) {
            const d = e.response?.data;
            failed = d?.message && e.response.status !== 500 ? (Object.values(d.errors ?? {})[0]?.[0] ?? d.message) : t('Não foi possível carregar o ficheiro. Tenta outra vez.');
            setErr(failed);
        } finally {
            endUpload(l.key, failed && t('Ficheiro “:name”: :error', { name: file.name, error: failed }));
            setProgress(null);
        }
    };
    const busy = progress !== null;

    return (
        <div className="flex flex-col gap-1.5">
            {!bare && (
                <span className="font-display text-[13px] font-semibold uppercase tracking-[0.04em]">
                    {main ? <>{t('Documento')}<span className="text-accent-ink"> *</span></> : t('Materiais de apoio')}
                    {!main && <span className="ml-1 font-sans text-xs font-normal normal-case tracking-normal text-muted">{t('(opcional: fichas técnicas, esquemas)')}</span>}
                </span>
            )}
            {l.attachments.map((a, i) => (
                <div key={a.path} className={`flex items-center gap-2.5 px-2.5 py-2 text-[13.5px] ${bare ? 'bg-surface' : 'bg-page'}`}>
                    <span className="bg-ink px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-on-ink">{a.name.split('.').pop()}</span>
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate hover:underline">{a.name}</a>
                    <small className="text-muted">{formatBytes(a.size)}</small>
                    <IconButton label={t('Remover ficheiro')} danger className="ml-auto" onClick={() => set((x) => { x.attachments.splice(i, 1); })}>✕</IconButton>
                </div>
            ))}
            {busy && (
                <div className="flex flex-col gap-2 bg-surface p-3">
                    <div className="flex items-center gap-3 text-sm">
                        <span className="min-w-0 flex-1 truncate">{t('A carregar')}{' '}<b>{name}</b>…</span>
                        <span className="font-mono text-xs font-semibold">{Math.round(progress * 100)}%</span>
                        <button type="button" onClick={() => { cancel.current = true; }} className="font-display text-[13px] font-semibold text-muted hover:text-live-ink">{t('Cancelar')}</button>
                    </div>
                    <div className="h-1.5 bg-track"><div className="h-full bg-accent transition-[width]" style={{ width: `${progress * 100}%` }} /></div>
                </div>
            )}
            {l.attachments.length < 20 && !busy && (
                <label className={main
                    ? 'block cursor-pointer border-[1.5px] border-dashed border-line bg-surface p-4 text-center text-sm text-muted hover:border-accent hover:text-ink'
                    : 'cursor-pointer self-start py-1 font-display text-[13.5px] font-semibold text-accent-ink hover:text-ink'}>
                    <input type="file" className="sr-only" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip"
                        onChange={(e) => { send(e.target.files[0]); e.target.value = ''; }} />
                    {main ? <><b className="text-ink">{t('Carregar ficheiro')}</b>{' '}{t('· PDF, imagens, Office · até :mb MB', { mb: attachmentMaxMb })}</> : t('+ Anexar ficheiro')}
                </label>
            )}
            {err && <p className="text-[13px] text-live-ink">{err}</p>}
        </div>
    );
}
