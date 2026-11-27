import { Field, inputCls, Panel, Seg } from './ui';
import { Hint, PalInput, QuestionsEditor, blankQuestion } from './Activities';

import { t } from '@/i18n';

// Passo 4 · Avaliação final do curso (fase 2, 2026-11-27): perguntas, avatar ou nenhuma; e o peso na nota final.
export default function StepFinal({ c, update, canAlex }) {
    const mode = c.final_mode ?? 'none';
    const setMode = (k) => update((d) => {
        d.final_mode = k;
        if (k === 'questions' && !(d.final_quiz ?? []).length) d.final_quiz = [blankQuestion()];
    });
    const weight = Number(c.final_weight ?? 50);

    return (
        <div className="flex flex-col gap-4">
            <Panel data-guide="final-mode" title={t('Avaliação final')} sub={t('Uma por curso. O aluno faz quando quiser, no botão “Avaliação” da página da aula.')}>
                <span className="mb-1.5 block font-display text-[13px] font-semibold uppercase tracking-[0.04em]">{t('Como é feita a avaliação final?')}</span>
                <Seg label={t('Como é feita a avaliação final?')} value={mode} onChange={setMode}
                    options={[['questions', t('Conjunto de perguntas')], ['avatar', t('Avaliação com avatar')], ['none', t('Sem avaliação final')]]} />

                {mode === 'questions' && (
                    <div className="mt-4">
                        <Hint>{t('Escolha múltipla ou verdadeiro/falso. A plataforma reparte os 100% por igual entre as perguntas.')}</Hint>
                        <QuestionsEditor owner={c} set={update} listKey="final_quiz" weightKey="final_weighted" idPrefix="final" />
                    </div>
                )}
                {mode === 'avatar' && (
                    <div className="mt-4">
                        <Hint>{t('O avatar faz perguntas sobre todo o curso. A nota (0 a 100%) vem da plataforma dos avatares. Não gasta os minutos do curso.')}</Hint>
                        <Field label={t('O que o avatar deve avaliar (opcional)')} id="f-final-prompt" className="mb-3">
                            <textarea id="f-final-prompt" rows={3} maxLength={2000} className={inputCls} value={c.final_prompt ?? ''}
                                placeholder={t('Ex.: perguntas sobre todos os módulos, uma de cada vez.')}
                                onChange={(e) => update((d) => { d.final_prompt = e.target.value; })} />
                        </Field>
                        <div className="grid gap-x-4 sm:grid-cols-[1fr_160px]">
                            <PalInput id="f-final-pal" label={t('PAL ID do avaliador (opcional: vazio = o avatar do curso)')} value={c.final_pal_id ?? ''} disabled={!canAlex}
                                onChange={(v) => update((d) => { d.final_pal_id = v; })} />
                            <Field label={t('Duração (min)')} id="f-final-min">
                                <input id="f-final-min" type="number" min="1" max="120" className={inputCls} value={c.final_minutes ?? 15}
                                    onChange={(e) => update((d) => { d.final_minutes = Math.max(1, Math.min(120, parseInt(e.target.value, 10) || 1)); })} />
                            </Field>
                        </div>
                    </div>
                )}
                {mode === 'none' && <div className="mt-3"><Hint>{t('O curso acaba quando o aluno termina as atividades. A nota final é só a média dos testes.')}</Hint></div>}

                {mode !== 'none' && (
                    <Field label={t('Nota mínima para passar (%)')} id="f-final-pass" className="mt-4 max-w-[200px]">
                        <input id="f-final-pass" type="number" min="0" max="100" className={inputCls} value={c.final_pass ?? 70}
                            onChange={(e) => update((d) => { d.final_pass = Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)); })} />
                    </Field>
                )}
            </Panel>

            <Panel data-guide="final-grade" title={t('Nota final do curso')} sub={t('Cada teste e a avaliação final têm nota de 0 a 100%. Os exercícios não contam.')}>
                {mode === 'none' ? (
                    <p className="text-[14px]">{t('Média dos testes: 100% da nota final.')}</p>
                ) : (
                    <>
                        <div className="mb-2 flex flex-wrap gap-2 text-[13px] font-semibold">
                            <span className="bg-page px-3 py-1.5">{t('Média dos testes · :w%', { w: 100 - weight })}</span>
                            <span className="bg-page px-3 py-1.5">{t('Avaliação final · :w%', { w: weight })}</span>
                        </div>
                        <label htmlFor="f-final-weight" className="mb-1 block text-[13px] text-muted">{t('Peso da avaliação final na nota')}</label>
                        <input id="f-final-weight" type="range" min="0" max="100" step="10" value={weight} className="w-full accent-[var(--color-accent)]"
                            onChange={(e) => update((d) => { d.final_weight = parseInt(e.target.value, 10); })} />
                        <Hint>{t('Se o curso não tiver testes com nota, a nota final é só a da avaliação final.')}</Hint>
                    </>
                )}
            </Panel>
        </div>
    );
}
