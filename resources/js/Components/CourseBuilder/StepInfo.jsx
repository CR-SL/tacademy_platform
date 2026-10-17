import { useState } from 'react';
import { AddLink, Field, IconButton, inputCls, Panel, Seg } from './ui';
import { levelLabels } from './format';

// Passo 1 · Informação: o que aparece no catálogo e na página do curso.
export default function StepInfo({ c, update, categories, library, shortMax, upload }) {
    const [drag, setDrag] = useState(false);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');

    const sendCover = async (file) => {
        if (!file) return;
        setErr('');
        setBusy(true);
        try {
            const r = await upload(file, 'cover');
            update((d) => { d.thumbnail_url = r.url; });
        } catch (e) {
            setErr(e.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="space-y-4">
            <Panel title="Informação do curso" sub="É o que os alunos vêem no catálogo e na página do curso.">
                <Field label="Título do curso" htmlFor="f-title" required>
                    <input
                        id="f-title"
                        className={inputCls}
                        value={c.title}
                        maxLength={200}
                        placeholder="Ex.: Diagnóstico de Sistemas de Injeção"
                        onChange={(e) => update((d) => { d.title = e.target.value; })}
                    />
                </Field>

                <div className="grid gap-x-5 sm:grid-cols-2">
                    <Field label="Área" htmlFor="f-area" required>
                        <select
                            id="f-area"
                            className={inputCls}
                            value={c.category_id ?? ''}
                            onChange={(e) => update((d) => { d.category_id = e.target.value ? Number(e.target.value) : null; })}
                        >
                            <option value="">Escolher área…</option>
                            {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                        </select>
                    </Field>
                    <Field label="Nível" required>
                        <Seg label="Nível" options={Object.entries(levelLabels)} value={c.level} onChange={(v) => update((d) => { d.level = v; })} />
                    </Field>
                </div>

                <Field label="Imagem de capa" required>
                    <div className="grid gap-5 sm:grid-cols-[200px_1fr]">
                        <div
                            className="ta-cut-12 relative flex aspect-[4/5] items-center justify-center overflow-hidden p-4 text-center text-[13px] text-muted"
                            style={{ background: 'repeating-linear-gradient(135deg, var(--color-surface2) 0 9px, var(--color-bg) 9px 18px)' }}
                        >
                            {c.thumbnail_url ? (
                                <img src={c.thumbnail_url} alt="Capa do curso" className="absolute inset-0 h-full w-full object-cover" />
                            ) : (
                                <span>Formato vertical 4:5<br />mín. 800 × 1000 px</span>
                            )}
                        </div>
                        <div>
                            <label
                                className={`ta-cut-8 block cursor-pointer border-[1.5px] border-dashed bg-page p-5 text-center text-muted transition-colors hover:border-accent hover:text-ink ${drag ? 'border-accent text-ink' : 'border-line'}`}
                                onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                                onDragLeave={() => setDrag(false)}
                                onDrop={(e) => { e.preventDefault(); setDrag(false); sendCover(e.dataTransfer.files[0]); }}
                            >
                                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { sendCover(e.target.files[0]); e.target.value = ''; }} />
                                {busy ? <b className="text-ink">A carregar…</b> : <><b className="text-ink">Carregar imagem</b> ou arrastar para aqui</>}
                                <br />
                                <small>JPG, PNG ou WebP · até 5 MB</small>
                            </label>
                            {err && <p className="mt-2 text-[13px] text-live">{err}</p>}
                            <p className="mt-3 text-[12.5px] text-muted">…ou escolhe uma da biblioteca da T.Academy:</p>
                            <div className="mt-2 grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                                {library.map((src) => (
                                    <button
                                        key={src}
                                        type="button"
                                        aria-label="Usar esta imagem"
                                        aria-pressed={c.thumbnail_url === src}
                                        onClick={() => update((d) => { d.thumbnail_url = src; })}
                                        className={`ta-cut-8 aspect-square overflow-hidden border-2 ${c.thumbnail_url === src ? 'border-accent' : 'border-transparent'}`}
                                    >
                                        <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </Field>

                <Field label="Descrição curta" htmlFor="f-short" required help="Uma frase que resume o curso — aparece no cartão do catálogo.">
                    <textarea
                        id="f-short"
                        rows={2}
                        className={inputCls}
                        value={c.short_description}
                        maxLength={200}
                        onChange={(e) => update((d) => { d.short_description = e.target.value; })}
                    />
                    <span className={`self-end font-mono text-[11px] ${c.short_description.length > shortMax ? 'text-live' : 'text-muted'}`}>
                        {c.short_description.length}/{shortMax}
                    </span>
                </Field>

                <Field label="Descrição completa" htmlFor="f-long" className="mb-0">
                    <textarea
                        id="f-long"
                        rows={5}
                        className={inputCls}
                        value={c.description}
                        placeholder="O que o curso aborda, como está organizado, porque é útil na oficina…"
                        onChange={(e) => update((d) => { d.description = e.target.value; })}
                    />
                </Field>
            </Panel>

            <Panel title="Para quem é" sub="Ajuda o aluno a perceber se o curso é para ele.">
                <Field label="O que vais aprender">
                    <div className="flex flex-col gap-2">
                        {c.learning_outcomes.map((t, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <span className="font-bold text-accent-ink" aria-hidden="true">✓</span>
                                <input
                                    className={inputCls}
                                    value={t}
                                    maxLength={200}
                                    aria-label={`Objetivo ${i + 1}`}
                                    placeholder="Ex.: Ler parâmetros de pressão no rail"
                                    onChange={(e) => update((d) => { d.learning_outcomes[i] = e.target.value; })}
                                />
                                <IconButton label="Remover objetivo" danger onClick={() => update((d) => {
                                    d.learning_outcomes.splice(i, 1);
                                    if (!d.learning_outcomes.length) d.learning_outcomes.push('');
                                })}>✕</IconButton>
                            </div>
                        ))}
                        {c.learning_outcomes.length < 20 && (
                            <AddLink onClick={() => update((d) => { d.learning_outcomes.push(''); })}>+ Adicionar objetivo</AddLink>
                        )}
                    </div>
                </Field>
                <div className="grid gap-x-5 sm:grid-cols-2">
                    <Field label="Pré-requisitos" htmlFor="f-pre" className="mb-0">
                        <input id="f-pre" className={inputCls} value={c.prerequisites} maxLength={255} placeholder="Ex.: Conhecimentos de OBD-II"
                            onChange={(e) => update((d) => { d.prerequisites = e.target.value; })} />
                    </Field>
                    <Field label="A quem se destina" htmlFor="f-aud" className="mb-0">
                        <input id="f-aud" className={inputCls} value={c.audience} maxLength={255} placeholder="Ex.: Mecânicos e técnicos de diagnóstico"
                            onChange={(e) => update((d) => { d.audience = e.target.value; })} />
                    </Field>
                </div>
            </Panel>
        </div>
    );
}
