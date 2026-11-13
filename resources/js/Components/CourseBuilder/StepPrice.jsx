import { Field, inputCls, Panel, Seg, Toggle } from './ui';

import { t } from '@/i18n';

const DEADLINES = [[null, 'Sem prazo'], [30, '30 dias'], [60, '60 dias'], [90, '90 dias'], [180, '6 meses']];

// Passo 3 · Preço e acesso.
export default function StepPrice({ c, update, canAlex }) {
    const lessons = c.modules.flatMap((m, mi) => m.lessons.map((l, li) => [l.key, `${mi + 1}.${li + 1} ${l.title || t('Aula sem título')}`]));

    return (
        <div className="space-y-4">
            <Panel title={t('Preço')} sub={t('Valor final pago pelo aluno, com IVA incluído.')}>
                <div className="mb-4">
                    <Seg label={t('Tipo de preço')} options={[[false, t('Pago')], [true, t('Gratuito')]]} value={c.is_free} onChange={(v) => update((d) => { d.is_free = v; })} />
                </div>
                {c.is_free ? (
                    <p className="text-muted">{t('O curso aparece no catálogo como')}{' '}<b className="text-ink">{t('Grátis')}</b>.</p>
                ) : (
                    <Field label={t('Preço')} htmlFor="f-price" required className="mb-0">
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

            <Panel title={t('Acesso e conclusão')} sub={t('Durante quanto tempo o aluno tem acesso e o que conta para terminar o curso.')}>
                <Field label={t('Validade do acesso')}>
                    <Seg
                        label={t('Validade do acesso')}
                        options={[[null, t('Vitalício')], [12, t('12 meses')], [6, t('6 meses')], [3, t('3 meses')]]}
                        value={c.access_months}
                        onChange={(v) => update((d) => {
                            d.access_months = v;
                            if (v && d.deadline_days > v * 30) d.deadline_days = null; // o prazo cabe no acesso
                        })}
                    />
                </Field>
                <Field label={t('Prazo para concluir')} help={t('Conta a partir da inscrição. Uma empresa pode definir outro prazo para a sua equipa.')}>
                    <Seg
                        label={t('Prazo para concluir')}
                        options={DEADLINES.map(([d, l]) => [d, t(l)]).filter(([d]) => !d || !c.access_months || d <= c.access_months * 30)}
                        value={c.deadline_days}
                        onChange={(v) => update((d) => { d.deadline_days = v; })}
                    />
                </Field>
                <Toggle checked={c.certificate_enabled} onChange={(v) => update((d) => { d.certificate_enabled = v; })} title={t('Emitir certificado')}>
                    {t('O aluno recebe um certificado T.Academy ao concluir.')}
                </Toggle>
                {c.certificate_enabled && (
                    <div className="flex flex-wrap gap-6 pb-3.5 pl-[52px]">
                        <Range label={t('Aulas vistas')} min={50} value={c.certificate_min_progress} onChange={(v) => update((d) => { d.certificate_min_progress = v; })} />
                        <Range label={t('Nota mínima nos testes')} min={0} value={c.certificate_min_score} onChange={(v) => update((d) => { d.certificate_min_score = v; })} />
                    </div>
                )}
                {c.certificate_enabled && (
                    <Toggle checked={c.requires_attendance} onChange={(v) => update((d) => { d.requires_attendance = v; })} title={t('Exigir presença')}>
                        {t('O certificado só é emitido depois de confirmares a presença do aluno, em “Os meus cursos” › Alunos.')}
                    </Toggle>
                )}
                <Field label={t('Aula de amostra grátis')} htmlFor="f-sample" className="mb-0 mt-2" help={t('Quem ainda não comprou pode ver esta aula para experimentar.')}>
                    <select id="f-sample" className={inputCls} value={c.sample_lesson_key} onChange={(e) => update((d) => { d.sample_lesson_key = e.target.value; })}>
                        <option value="">{t('Nenhuma')}</option>
                        {lessons.map(([k, tx]) => <option key={k} value={k}>{tx}</option>)}
                    </select>
                </Field>
            </Panel>

            <Panel title={t('Formador IA (Alex)')} sub={t('O aluno fala com o Alex, um avatar com vídeo e voz, no Início, nas Avaliações e durante as aulas deste curso.')}>
                {canAlex ? (
                    <>
                        <Toggle checked={c.alex_enabled} onChange={(v) => update((d) => { d.alex_enabled = v; })} title={t('Apoio do formador IA')}>
                            {t('Cada conversa tem custo (minutos no Tavus). Até 15 minutos por conversa e 3 conversas por dia por aluno.')}
                        </Toggle>
                        {c.alex_enabled && (
                            <div className="grid gap-x-4 pl-[52px] sm:grid-cols-2">
                                <Field label={t('Alex do curso (PAL do Tavus)')} htmlFor="f-alex-pal" className="mb-0" help={t('Opcional. Vazio = o Alex geral da T.Academy.')}>
                                    <input id="f-alex-pal" className={inputCls} value={c.alex_pal_id} maxLength={64} placeholder="p18d6e1b675e" autoComplete="off" spellCheck={false}
                                        onChange={(e) => update((d) => { d.alex_pal_id = e.target.value.trim(); })} />
                                </Field>
                                <Field label={t('Rosto (face do Tavus)')} htmlFor="f-alex-face" className="mb-0" help={t('Opcional. Só se o PAL não tiver um rosto por omissão.')}>
                                    <input id="f-alex-face" className={inputCls} value={c.alex_face_id} maxLength={64} placeholder="rdea4449f835" autoComplete="off" spellCheck={false}
                                        onChange={(e) => update((d) => { d.alex_face_id = e.target.value.trim(); })} />
                                </Field>
                            </div>
                        )}
                    </>
                ) : (
                    <p className="text-muted">
                        {c.alex_enabled
                            ? t('Este curso tem o formador IA (Alex), ligado pela equipa T.Academy.')
                            : <>{t('O formador IA (Alex) é ligado pela equipa T.Academy. Se o quiseres neste curso, ')}<a className="ui-link" href="/plataforma/contactos" target="_blank" rel="noopener noreferrer">{t('fala connosco')}</a>.</>}
                    </p>
                )}
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
