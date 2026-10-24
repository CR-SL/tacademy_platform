import { Field, inputCls, Panel, Seg, Toggle } from './ui';

// Passo 3 · Preço e acesso.
export default function StepPrice({ c, update }) {
    const lessons = c.modules.flatMap((m, mi) => m.lessons.map((l, li) => [l.key, `${mi + 1}.${li + 1} ${l.title || 'Aula sem título'}`]));

    return (
        <div className="space-y-4">
            <Panel title="Preço" sub="Valor final pago pelo aluno, com IVA incluído.">
                <div className="mb-4">
                    <Seg label="Tipo de preço" options={[[false, 'Pago'], [true, 'Gratuito']]} value={c.is_free} onChange={(v) => update((d) => { d.is_free = v; })} />
                </div>
                {c.is_free ? (
                    <p className="text-muted">O curso aparece no catálogo como <b className="text-ink">Grátis</b>.</p>
                ) : (
                    <Field label="Preço" htmlFor="f-price" required className="mb-0">
                        <div className="flex max-w-[240px]">
                            <input
                                id="f-price"
                                type="number"
                                min="0"
                                max="99999"
                                step="0.01"
                                inputMode="decimal"
                                className={`${inputCls} font-display text-[22px] font-bold`}
                                value={c.price}
                                placeholder="49,90"
                                onChange={(e) => update((d) => { d.price = e.target.value; })}
                            />
                            <span className="flex items-center border border-l-0 border-line bg-surface2 px-3.5 font-display text-lg font-bold">€</span>
                        </div>
                    </Field>
                )}
            </Panel>

            <Panel title="Acesso e conclusão" sub="Durante quanto tempo o aluno tem acesso e o que conta para terminar o curso.">
                <Field label="Validade do acesso">
                    <Seg
                        label="Validade do acesso"
                        options={[[null, 'Vitalício'], [12, '12 meses'], [6, '6 meses'], [3, '3 meses']]}
                        value={c.access_months}
                        onChange={(v) => update((d) => { d.access_months = v; })}
                    />
                </Field>
                <Field label="Aulas desbloqueadas de cada vez" help={c.unlock_window === 0
                    ? 'O aluno pode fazer as aulas pela ordem que quiser.'
                    : c.unlock_window === 1
                        ? 'Ordem estrita: cada aula só abre depois de o aluno concluir a anterior.'
                        : `Ficam sempre ${c.unlock_window} aulas por fazer abertas; ao concluir uma, abre a seguinte. Os testes de módulo contam como aulas.`}>
                    <Seg
                        label="Aulas desbloqueadas de cada vez"
                        options={[[1, '1 (por ordem)'], [3, '3'], [5, '5'], [0, 'Todas']]}
                        value={c.unlock_window}
                        onChange={(v) => update((d) => { d.unlock_window = v; })}
                    />
                </Field>
                <Toggle checked={c.certificate_enabled} onChange={(v) => update((d) => { d.certificate_enabled = v; })} title="Emitir certificado">
                    O aluno recebe um certificado T.Academy ao concluir.
                </Toggle>
                {c.certificate_enabled && (
                    <div className="flex flex-wrap gap-6 pb-3.5 pl-[52px]">
                        <Range label="Aulas vistas" min={50} value={c.certificate_min_progress} onChange={(v) => update((d) => { d.certificate_min_progress = v; })} />
                        <Range label="Nota mínima nos quizzes" min={0} value={c.certificate_min_score} onChange={(v) => update((d) => { d.certificate_min_score = v; })} />
                    </div>
                )}
                <Field label="Aula de amostra grátis" htmlFor="f-sample" className="mb-0 mt-2" help="Quem ainda não comprou pode ver esta aula para experimentar.">
                    <select id="f-sample" className={inputCls} value={c.sample_lesson_key} onChange={(e) => update((d) => { d.sample_lesson_key = e.target.value; })}>
                        <option value="">Nenhuma</option>
                        {lessons.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
                    </select>
                </Field>
            </Panel>
        </div>
    );
}

function Range({ label, min, value, onChange }) {
    return (
        <label className="flex flex-col gap-1.5">
            <span className="font-display text-[13px] font-semibold uppercase tracking-[0.04em]">{label}</span>
            <span className="flex items-center gap-2.5">
                <input type="range" min={min} max="100" step="5" value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-40 accent-[#F8B101]" />
                <b className="min-w-[46px] font-display text-base">{value}%</b>
            </span>
        </label>
    );
}
