import { useState } from 'react';
import { AddLink, Field, IconButton, inputCls, Panel } from './ui';
import { formatBytes, formatMinutes, isHttpUrl, linkInfo } from './format';
import { lessonComplete, newKey, totalMinutes } from './model';

export const LESSON_TYPES = {
    video_link: { label: 'Vídeo', short: '▶', hint: 'link', cls: 'bg-ink text-accent' },
    avatar: { label: 'Avatar IA', short: 'IA', hint: 'link', cls: 'bg-accent text-on-accent' },
    document: { label: 'Documento', short: 'PDF', hint: 'ficheiro', cls: 'bg-surface2' },
    text: { label: 'Texto', short: 'Aa', cls: 'bg-surface2' },
    quiz: { label: 'Quiz', short: '?', cls: 'bg-surface2' },
};
// Tipos antigos (criados no backoffice) que o editor mostra mas não oferece
const LEGACY = { video_upload: { label: 'Vídeo (upload)', short: '▶', cls: 'bg-ink text-accent' }, live: { label: 'Ao vivo', short: '●', cls: 'bg-surface2' } };
const typeOf = (t) => LESSON_TYPES[t] ?? LEGACY[t] ?? LESSON_TYPES.video_link;

export const blankLesson = () => ({ key: newKey(), id: null, title: '', type: 'video_link', url: '', minutes: '', body: '', attachments: [], quiz: [], checks: [] });
const blankQuestion = () => ({ question: '', options: ['', ''], correct: 0 });

// Passo 2 · Programa: módulos e aulas, por ordem.
export default function StepProgram({ c, update, upload, openKey, setOpenKey }) {
    const lessons = c.modules.reduce((a, m) => a + m.lessons.length, 0);
    const move = (arr, i, d) => { const j = i + d; if (j >= 0 && j < arr.length) [arr[i], arr[j]] = [arr[j], arr[i]]; };

    return (
        <Panel title="Programa" sub="Organiza o curso em módulos e aulas. Usa as setas para mudar a ordem.">
            <div className="mb-4 flex flex-wrap gap-5 font-mono text-xs tracking-[0.06em] text-muted">
                <span><b className="mr-1 font-display text-base text-ink">{c.modules.length}</b>MÓDULOS</span>
                <span><b className="mr-1 font-display text-base text-ink">{lessons}</b>AULAS</span>
                <span><b className="mr-1 font-display text-base text-ink">{formatMinutes(totalMinutes(c))}</b>DURAÇÃO TOTAL</span>
            </div>

            {c.modules.map((m, mi) => (
                <div key={m.key} className="ta-cut-12 mb-3.5 border border-line bg-surface">
                    <div className="flex flex-wrap items-center gap-3 bg-page px-4 py-3">
                        <span className="font-mono text-[13px] font-bold text-accent-ink">{String(mi + 1).padStart(2, '0')}</span>
                        <input
                            className="min-w-0 flex-1 border-b border-transparent bg-transparent py-1 font-display text-[17px] font-semibold focus:border-accent focus:outline-none"
                            value={m.title}
                            maxLength={200}
                            placeholder="Título do módulo"
                            aria-label={`Título do módulo ${mi + 1}`}
                            onChange={(e) => update((d) => { d.modules[mi].title = e.target.value; })}
                        />
                        <div className="flex gap-1.5">
                            <IconButton label="Subir módulo" disabled={mi === 0} onClick={() => update((d) => move(d.modules, mi, -1))}>↑</IconButton>
                            <IconButton label="Descer módulo" disabled={mi === c.modules.length - 1} onClick={() => update((d) => move(d.modules, mi, 1))}>↓</IconButton>
                            <IconButton
                                label="Apagar módulo"
                                danger
                                onClick={() => {
                                    if (m.lessons.length && !confirm(`Apagar o módulo “${m.title || 'sem título'}” e as suas ${m.lessons.length} aula(s)?`)) return;
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
                            placeholder="Descrição do módulo (opcional)"
                            aria-label={`Descrição do módulo ${mi + 1}`}
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
                                set={(fn) => update((d) => fn(d.modules[mi].lessons[li]))}
                                onMove={(dir) => update((d) => move(d.modules[mi].lessons, li, dir))}
                                onDelete={() => {
                                    if (!confirm(`Apagar a aula “${l.title || 'sem título'}”?`)) return;
                                    update((d) => {
                                        d.modules[mi].lessons.splice(li, 1);
                                        if (d.sample_lesson_key === l.key) d.sample_lesson_key = '';
                                    });
                                }}
                                upload={upload}
                            />
                        ))}
                        <button
                            type="button"
                            className="self-start px-3 py-2 font-display text-xs font-bold uppercase tracking-[0.04em] shadow-[inset_0_0_0_1px_var(--color-line)] hover:bg-page"
                            onClick={() => {
                                const l = blankLesson();
                                update((d) => { d.modules[mi].lessons.push(l); });
                                setOpenKey(l.key);
                            }}
                        >
                            + Aula
                        </button>
                    </div>
                </div>
            ))}

            {c.modules.length < 50 && (
                <button
                    type="button"
                    className="ta-cut-8 ta-press bg-surface px-5 py-3 font-display text-sm font-bold uppercase tracking-[0.04em] shadow-[inset_0_0_0_1.5px_var(--color-line)] hover:bg-page"
                    onClick={() => update((d) => { d.modules.push({ key: newKey(), id: null, title: '', description: '', lessons: [] }); })}
                >
                    + Adicionar módulo
                </button>
            )}
        </Panel>
    );
}

function LessonRow({ l, index, count, open, onToggle, set, onMove, onDelete, upload }) {
    const t = typeOf(l.type);
    const ok = lessonComplete(l);
    const extra = l.type !== 'document' && l.attachments.length ? ` · ${l.attachments.length} anexo${l.attachments.length > 1 ? 's' : ''}` : '';

    return (
        <div className="border border-line bg-surface">
            <div className="grid grid-cols-[34px_1fr_auto] items-center gap-2.5 px-3 py-2.5 sm:grid-cols-[34px_1fr_auto_auto]">
                <button type="button" onClick={onToggle} aria-expanded={open} aria-label={`${open ? 'Fechar' : 'Abrir'} aula ${index + 1}`}
                    className={`ta-cut-8 flex h-[34px] w-[34px] items-center justify-center font-mono text-[11px] font-bold ${t.cls}`}>
                    {t.short}
                </button>
                <button type="button" onClick={onToggle} className="min-w-0 text-left">
                    <span className={`block truncate ${l.title ? 'font-medium' : 'italic text-muted'}`}>{l.title || 'Aula sem título'}</span>
                    <small className="block text-xs text-muted">{t.label}{l.minutes ? ` · ${l.minutes} min` : ''}{extra}</small>
                </button>
                <span className={`hidden font-mono text-[11px] font-semibold tracking-[0.04em] sm:inline ${ok ? 'text-[#2F9E5B]' : 'text-live'}`}>
                    {ok ? '✓ COMPLETA' : 'INCOMPLETA'}
                </span>
                <span className="flex gap-1">
                    <IconButton label="Subir aula" className="hidden sm:inline-flex" disabled={index === 0} onClick={() => onMove(-1)}>↑</IconButton>
                    <IconButton label="Descer aula" className="hidden sm:inline-flex" disabled={index === count - 1} onClick={() => onMove(1)}>↓</IconButton>
                    <IconButton label="Apagar aula" danger onClick={onDelete}>✕</IconButton>
                </span>
            </div>
            {open && <LessonEditor l={l} set={set} upload={upload} />}
        </div>
    );
}

function LessonEditor({ l, set, upload }) {
    const id = `l-${l.key}`;
    const info = linkInfo(l.url);

    return (
        <div className="border-t border-line px-3.5 pb-4 sm:pl-[66px]">
            <div className="my-3 flex flex-wrap gap-1.5" role="group" aria-label="Tipo de aula">
                {Object.entries(LESSON_TYPES).map(([k, t]) => (
                    <button
                        key={k}
                        type="button"
                        aria-pressed={l.type === k}
                        onClick={() => set((x) => {
                            x.type = k;
                            if (k === 'quiz' && !x.quiz.length) x.quiz.push(blankQuestion());
                        })}
                        className={`inline-flex items-center gap-2 border px-3 py-2 font-display text-[13px] font-semibold ${
                            l.type === k ? 'border-ink bg-ink text-accent' : 'border-line bg-surface hover:border-muted'
                        }`}
                    >
                        {t.label}
                        {t.hint && <em className="font-mono text-[10px] not-italic opacity-70">{t.hint}</em>}
                    </button>
                ))}
            </div>

            <div className="grid gap-x-4 sm:grid-cols-[1fr_150px]">
                <Field label="Título da aula" htmlFor={`${id}-t`} required>
                    <input id={`${id}-t`} className={inputCls} value={l.title} maxLength={200} placeholder="Ex.: Introdução ao sistema"
                        onChange={(e) => set((x) => { x.title = e.target.value; })} />
                </Field>
                <Field label="Duração (min)" htmlFor={`${id}-m`}>
                    <input id={`${id}-m`} type="number" min="0" max="600" className={inputCls} value={l.minutes} placeholder="10"
                        onChange={(e) => set((x) => { x.minutes = e.target.value === '' ? '' : Math.max(0, Math.min(600, parseInt(e.target.value, 10) || 0)); })} />
                </Field>
            </div>

            {(l.type === 'video_link' || l.type === 'video_upload' || l.type === 'avatar') && (
                <Field
                    label={l.type === 'avatar' ? 'Link do avatar de IA' : 'Link do vídeo'}
                    htmlFor={`${id}-u`}
                    required
                    help={l.type === 'avatar'
                        ? 'O avatar abre dentro da aula. Mais tarde a ligação pode passar a ser feita por API.'
                        : 'YouTube (não listado), Vimeo ou outro link. Mais tarde poderá haver upload direto.'}
                >
                    <input id={`${id}-u`} className={inputCls} value={l.url} maxLength={500}
                        placeholder={l.type === 'avatar' ? 'https://… (link da plataforma do avatar)' : 'https://www.youtube.com/watch?v=… ou https://vimeo.com/…'}
                        onChange={(e) => set((x) => { x.url = e.target.value; })} />
                    {info ? (
                        <div className="ta-cut-8 mt-1 flex flex-wrap items-center gap-3 bg-page p-2.5">
                            {info.thumb && <img src={info.thumb} alt="" className="aspect-video w-[120px] object-cover" />}
                            <span className="bg-ink px-2 py-0.5 font-mono text-[11px] font-semibold text-accent">{info.tag}</span>
                            <span className="font-mono text-[11px] font-semibold text-[#2F9E5B]">✓ LINK VÁLIDO</span>
                            {isHttpUrl(l.url) && (
                                <a href={l.url.trim()} target="_blank" rel="noopener noreferrer" className="ml-auto font-display text-[13px] font-semibold text-accent-ink hover:text-ink">
                                    Abrir ↗
                                </a>
                            )}
                        </div>
                    ) : l.url ? (
                        <span className="font-mono text-[11px] font-semibold text-live">LINK INVÁLIDO — tem de começar por https://</span>
                    ) : null}
                </Field>
            )}

            {(l.type === 'video_link' || l.type === 'video_upload') && <ChecksEditor l={l} set={set} />}

            {l.type === 'text' && (
                <Field label="Conteúdo" htmlFor={`${id}-b`} required>
                    <textarea id={`${id}-b`} rows={7} className={inputCls} value={l.body} placeholder="Escreve aqui a aula…"
                        onChange={(e) => set((x) => { x.body = e.target.value; })} />
                </Field>
            )}

            {l.type === 'quiz' && <QuizEditor l={l} set={set} />}

            <Attachments
                l={l}
                set={set}
                upload={upload}
                main={l.type === 'document'}
            />
        </div>
    );
}

const blankCheck = () => ({ question: '', options: ['', '', ''], correct: 0, explanation: '' });

// Perguntas rápidas no fim do vídeo: o aluno tem de responder para concluir a aula, mas não precisa de acertar
function ChecksEditor({ l, set }) {
    const checks = l.checks ?? [];
    return (
        <div className="mb-5 flex flex-col gap-1.5">
            <span className="font-display text-[13px] font-semibold uppercase tracking-[0.04em]">
                Perguntas rápidas
                <span className="ml-1 font-sans text-xs font-normal normal-case tracking-normal text-muted">
                    (2 a 3, no fim do vídeo — o aluno tem de responder, mas não conta para a nota)
                </span>
            </span>
            {checks.map((q, qi) => (
                <div key={qi} className="ta-cut-8 bg-page p-3.5">
                    <div className="flex gap-2">
                        <input className={inputCls} value={q.question} maxLength={500} placeholder={`Pergunta ${qi + 1}`} aria-label={`Pergunta rápida ${qi + 1}`}
                            onChange={(e) => set((x) => { x.checks[qi].question = e.target.value; })} />
                        <IconButton label="Remover pergunta" danger onClick={() => set((x) => { x.checks.splice(qi, 1); })}>✕</IconButton>
                    </div>
                    {q.options.map((o, oi) => (
                        <div key={oi} className="mt-1.5 flex items-center gap-2">
                            <input className={inputCls} value={o} maxLength={300} placeholder={`Opção ${oi + 1}`} aria-label={`Pergunta rápida ${qi + 1}, opção ${oi + 1}`}
                                onChange={(e) => set((x) => { x.checks[qi].options[oi] = e.target.value; })} />
                            <label className="flex items-center gap-1 whitespace-nowrap text-xs text-muted">
                                <input type="radio" name={`chk-${l.key}-${qi}`} checked={q.correct === oi} className="text-accent focus:ring-accent"
                                    onChange={() => set((x) => { x.checks[qi].correct = oi; })} />
                                certa
                            </label>
                        </div>
                    ))}
                    {q.options.length < 4 && <AddLink onClick={() => set((x) => { x.checks[qi].options.push(''); })}>+ Opção</AddLink>}
                    <input className={`${inputCls} mt-1.5`} value={q.explanation ?? ''} maxLength={500} placeholder="Explicação mostrada depois de responder (opcional)"
                        aria-label={`Explicação da pergunta rápida ${qi + 1}`} onChange={(e) => set((x) => { x.checks[qi].explanation = e.target.value; })} />
                </div>
            ))}
            <div className="flex flex-wrap items-center gap-4">
                {checks.length < 5 && (
                    <AddLink onClick={() => set((x) => { x.checks = [...(x.checks ?? []), blankCheck()]; })}>+ Adicionar pergunta rápida</AddLink>
                )}
                <button type="button" disabled title="Em breve: a IA gera as perguntas a partir do vídeo"
                    className="cursor-not-allowed py-1.5 font-display text-[13.5px] font-semibold text-muted">
                    ✦ Gerar com IA <span className="font-sans text-xs font-normal">(em breve)</span>
                </button>
            </div>
        </div>
    );
}

function QuizEditor({ l, set }) {
    return (
        <Field label="Perguntas" required help="Marca a resposta certa em cada pergunta. Mínimo 2 opções.">
            {l.quiz.map((q, qi) => (
                <div key={qi} className="ta-cut-8 mb-2 bg-page p-3.5">
                    <div className="flex gap-2">
                        <input className={inputCls} value={q.question} maxLength={500} placeholder={`Pergunta ${qi + 1}`} aria-label={`Pergunta ${qi + 1}`}
                            onChange={(e) => set((x) => { x.quiz[qi].question = e.target.value; })} />
                        <IconButton label="Remover pergunta" danger onClick={() => set((x) => { x.quiz.splice(qi, 1); })}>✕</IconButton>
                    </div>
                    {q.options.map((o, oi) => (
                        <div key={oi} className="mt-1.5 flex items-center gap-2">
                            <input className={inputCls} value={o} maxLength={300} placeholder={`Opção ${oi + 1}`} aria-label={`Pergunta ${qi + 1}, opção ${oi + 1}`}
                                onChange={(e) => set((x) => { x.quiz[qi].options[oi] = e.target.value; })} />
                            <label className="flex items-center gap-1 whitespace-nowrap text-xs text-muted">
                                <input type="radio" name={`c-${l.key}-${qi}`} checked={q.correct === oi} className="text-accent focus:ring-accent"
                                    onChange={() => set((x) => { x.quiz[qi].correct = oi; })} />
                                certa
                            </label>
                            {q.options.length > 2 && (
                                <IconButton label="Remover opção" danger onClick={() => set((x) => {
                                    const qq = x.quiz[qi];
                                    qq.options.splice(oi, 1);
                                    if (qq.correct >= qq.options.length || qq.correct === oi) qq.correct = 0;
                                    else if (qq.correct > oi) qq.correct -= 1;
                                })}>✕</IconButton>
                            )}
                        </div>
                    ))}
                    {q.options.length < 8 && <AddLink onClick={() => set((x) => { x.quiz[qi].options.push(''); })}>+ Opção</AddLink>}
                </div>
            ))}
            <AddLink onClick={() => set((x) => { x.quiz.push(blankQuestion()); })}>+ Adicionar pergunta</AddLink>
        </Field>
    );
}

function Attachments({ l, set, upload, main }) {
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');

    const send = async (file) => {
        if (!file) return;
        setErr('');
        setBusy(true);
        try {
            const r = await upload(file, 'attachment');
            set((x) => { x.attachments.push({ name: r.name, path: r.path, size: r.size, url: r.url }); });
        } catch (e) {
            setErr(e.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="flex flex-col gap-1.5">
            <span className="font-display text-[13px] font-semibold uppercase tracking-[0.04em]">
                {main ? <>Documento<span className="text-accent-ink"> *</span></> : 'Materiais de apoio'}
                {!main && <span className="ml-1 font-sans text-xs font-normal normal-case tracking-normal text-muted">(opcional — fichas técnicas, esquemas)</span>}
            </span>
            {l.attachments.map((a, i) => (
                <div key={a.path} className="flex items-center gap-2.5 bg-page px-2.5 py-2 text-[13.5px]">
                    <span className="bg-ink px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-accent">{a.name.split('.').pop()}</span>
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate hover:underline">{a.name}</a>
                    <small className="text-muted">{formatBytes(a.size)}</small>
                    <IconButton label="Remover ficheiro" danger className="ml-auto" onClick={() => set((x) => { x.attachments.splice(i, 1); })}>✕</IconButton>
                </div>
            ))}
            {l.attachments.length < 20 && (
                <label className={main
                    ? 'ta-cut-8 block cursor-pointer border-[1.5px] border-dashed border-line bg-page p-4 text-center text-sm text-muted hover:border-accent hover:text-ink'
                    : 'cursor-pointer self-start py-1 font-display text-[13.5px] font-semibold text-accent-ink hover:text-ink'}>
                    <input type="file" className="sr-only" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip"
                        onChange={(e) => { send(e.target.files[0]); e.target.value = ''; }} />
                    {busy ? 'A carregar…' : main ? <><b className="text-ink">Carregar ficheiro</b> · PDF, imagens, Office · até 20 MB</> : '+ Anexar ficheiro'}
                </label>
            )}
            {err && <p className="text-[13px] text-live">{err}</p>}
        </div>
    );
}
