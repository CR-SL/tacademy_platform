// Editores das atividades que não são aulas (fase 2, 2026-11-27): Teste, Exercício e Roleplay,
// e as perguntas com a pontuação automática (100% repartidos por igual) ou com pesos (opcional).
import { AddLink, Field, IconButton, inputCls, Seg } from './ui';
import { newKey } from './model';

import { t } from '@/i18n';

export const blankQuestion = (options = ['', '']) => ({ key: newKey(), id: null, question: '', points: 1, options: [...options], option_ids: options.map(() => null), correct: 0 });

export function Hint({ children }) {
    return (
        <p className="mb-2.5 mt-1 flex gap-2 text-[12.5px] text-muted">
            <span aria-hidden="true" className="mt-px grid h-[17px] w-[17px] flex-none place-items-center rounded-full bg-ink font-display text-[11px] font-bold text-on-ink">?</span>
            <span>{children}</span>
        </p>
    );
}

export function PalInput({ id, label, value, onChange, disabled }) {
    const bad = value && !/^[A-Za-z0-9_-]+$/.test(value);
    return (
        <Field label={label} id={id} hint={disabled ? t('Só quem gere o avatar pode mudar o PAL ID.') : undefined}>
            <input id={id} className={`${inputCls} font-mono`} value={value} maxLength={64} placeholder="p18d6e1b675e" autoComplete="off" spellCheck={false} disabled={disabled}
                onChange={(e) => onChange(e.target.value.trim())} />
            {bad && <span className="text-[13px] text-live-ink">{t('O PAL ID só tem letras, números, - e _.')}</span>}
        </Field>
    );
}

// Quanto vale cada pergunta (em %): por igual, ou pelos pesos
const valueOf = (list, q, weighted) => {
    const total = weighted ? list.reduce((s, x) => s + (Number(x.points) || 1), 0) : list.length;
    const v = ((weighted ? Number(q.points) || 1 : 1) / (total || 1)) * 100;
    return `${(Math.round(v * 10) / 10).toString().replace('.', ',')}%`;
};

// Perguntas de um teste, exercício ou da avaliação final. set((x) => …) muda o dono (aula ou curso).
export function QuestionsEditor({ owner, set, listKey = 'quiz', weightKey = 'weighted', graded = true, idPrefix }) {
    const list = owner[listKey] ?? [];
    const weighted = graded && !!owner[weightKey];
    const edit = (fn) => set((x) => { x[listKey] = x[listKey] ?? []; fn(x[listKey], x); });

    return (
        <div className="flex flex-col gap-2">
            {list.map((q, qi) => (
                <div key={q.key ?? qi} className="bg-page p-3.5">
                    <div className="flex items-center gap-2">
                        <input className={inputCls} value={q.question} maxLength={500} placeholder={t('Pergunta :v1', { v1: qi + 1 })} aria-label={t('Pergunta :v1', { v1: qi + 1 })}
                            onChange={(e) => edit((qs) => { qs[qi].question = e.target.value; })} />
                        {weighted && (
                            <input type="number" min="1" max="100" className={`${inputCls} !w-20`} value={q.points ?? 1} aria-label={t('Peso da pergunta :v1', { v1: qi + 1 })}
                                onChange={(e) => edit((qs) => { qs[qi].points = Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 1)); })} />
                        )}
                        {graded && <span className="w-14 flex-none text-right font-display text-sm font-extrabold" title={t('Quanto vale esta pergunta')}>{valueOf(list, q, weighted)}</span>}
                        <IconButton label={t('Remover pergunta')} danger onClick={() => edit((qs) => { qs.splice(qi, 1); })}>✕</IconButton>
                    </div>
                    {q.options.map((o, oi) => (
                        <div key={oi} className="mt-1.5 flex items-center gap-2">
                            <input className={inputCls} value={o} maxLength={300} placeholder={t('Opção :v1', { v1: oi + 1 })} aria-label={t('Pergunta :v1, opção :v2', { v1: qi + 1, v2: oi + 1 })}
                                onChange={(e) => edit((qs) => { qs[qi].options[oi] = e.target.value; })} />
                            <label className="flex items-center gap-1 whitespace-nowrap text-xs text-muted">
                                <input type="radio" name={`${idPrefix}-c-${qi}`} checked={q.correct === oi} className="text-accent focus:ring-ink"
                                    onChange={() => edit((qs) => { qs[qi].correct = oi; })} />
                                {t('certa')}
                            </label>
                            {q.options.length > 2 && (
                                <IconButton label={t('Remover opção')} danger onClick={() => edit((qs) => {
                                    const qq = qs[qi];
                                    qq.options.splice(oi, 1);
                                    qq.option_ids?.splice(oi, 1);
                                    if (qq.correct >= qq.options.length || qq.correct === oi) qq.correct = 0;
                                    else if (qq.correct > oi) qq.correct -= 1;
                                })}>✕</IconButton>
                            )}
                        </div>
                    ))}
                    {q.options.length < 8 && <AddLink onClick={() => edit((qs) => { qs[qi].options.push(''); qs[qi].option_ids?.push(null); })}>{t('+ Opção')}</AddLink>}
                </div>
            ))}
            <div className="flex flex-wrap gap-4">
                <AddLink onClick={() => edit((qs) => { qs.push(blankQuestion()); })}>{t('+ Escolha múltipla')}</AddLink>
                <AddLink onClick={() => edit((qs) => { qs.push(blankQuestion([t('Verdadeiro'), t('Falso')])); })}>{t('+ Verdadeiro ou falso')}</AddLink>
            </div>
            {graded && list.length > 0 && (
                <>
                    <div className="flex justify-between border-t border-dashed border-line pt-2.5 text-[13px]">
                        <span>{t('Total')}</span>
                        <b>{list.length === 1 ? t('1 pergunta = 100%') : t(':n perguntas = 100%', { n: list.length })}</b>
                    </div>
                    <label className="flex items-center gap-2 text-[13px]">
                        <input type="checkbox" checked={weighted} className="text-accent focus:ring-ink" onChange={(e) => set((x) => { x[weightKey] = e.target.checked; })} />
                        {t('Dar pesos diferentes às perguntas')}<span className="text-muted">{t('(opcional)')}</span>
                    </label>
                </>
            )}
        </div>
    );
}

// A persona do Tavus que faz esta atividade (opção 1, 2026-11-27): o guião (casos, regras, como avalia) e os documentos
// estão na persona; a plataforma diz só quem é o aluno e "começa". O Alex do curso fica só para tirar dúvidas.
export function PersonaField({ value, onChange, canAlex, id, what }) {
    return (
        <div className="mb-4">
            <PalInput id={`${id}-pal`} label={t('PAL ID da persona no Tavus')} value={value ?? ''} disabled={!canAlex} onChange={onChange} />
            <p className="mt-1.5 text-[12.5px] text-muted">{t('O guião :what (o que faz, os casos, como avalia) e os documentos ficam na persona, no Tavus. A plataforma só lhe diz quem é o aluno e que comece.', { what })}</p>
        </div>
    );
}

export function ExtraInstruction({ value, onChange, id, placeholder }) {
    return (
        <Field label={t('Instrução extra para a persona (opcional)')} id={`${id}-extra`} className="mb-3"
            hint={t('Só se precisares de mudar algo nesta atividade. O aluno não vê.')}>
            <textarea id={`${id}-extra`} rows={2} maxLength={2000} className={inputCls} value={value ?? ''} placeholder={placeholder}
                onChange={(e) => onChange(e.target.value)} />
        </Field>
    );
}
export function TestEditor({ l, set, canAlex, id }) {
    return (
        <div>
            <span className="mb-1.5 block font-display text-[13px] font-semibold uppercase tracking-[0.04em]">{t('Tipo de teste')}</span>
            <Seg label={t('Tipo de teste')} value={l.evaluation === 'avatar' ? 'avatar' : 'quiz'}
                onChange={(k) => set((x) => { x.evaluation = k; if (k === 'quiz' && !(x.quiz ?? []).length) x.quiz = [blankQuestion()]; })}
                options={[['quiz', t('Escrito')], ['avatar', t('Com avatar')]]} />
            {l.evaluation === 'avatar' ? (
                <div className="mt-3">
                    <Hint>{t('O avatar apresenta casos práticos e o aluno responde a falar. A nota (0 a 100%) vem da plataforma dos avatares.')}</Hint>
                    <PersonaField id={id} canAlex={canAlex} what={t('do teste')} value={l.evaluation_pal_id}
                        onChange={(v) => set((x) => { x.evaluation_pal_id = v; })} />
                    <ExtraInstruction id={id} value={l.evaluation_prompt} placeholder={t('Ex.: nesta turma, foca-te mais no diagnóstico de fugas.')}
                        onChange={(v) => set((x) => { x.evaluation_prompt = v; })} />
                </div>
            ) : (
                <div className="mt-3">
                    <Hint>{t('Escolha múltipla ou verdadeiro/falso. A plataforma reparte os 100% por igual entre as perguntas: com 5 perguntas, cada uma vale 20%. O aluno tem 3 tentativas.')}</Hint>
                    <QuestionsEditor owner={l} set={set} idPrefix={id} />
                </div>
            )}
        </div>
    );
}

export function ExerciseEditor({ l, set, id, attachments }) {
    return (
        <div>
            <span className="mb-1.5 block font-display text-[13px] font-semibold uppercase tracking-[0.04em]">{t('Tipo de exercício')}</span>
            <Seg label={t('Tipo de exercício')} value={l.evaluation === 'quiz' ? 'quiz' : 'none'}
                onChange={(k) => set((x) => { x.evaluation = k; if (k === 'quiz' && !(x.quiz ?? []).length) x.quiz = [blankQuestion()]; })}
                options={[['none', t('Exercício prático')], ['quiz', t('Perguntas sem nota')]]} />
            <Hint>{t('Para praticar, sem nota: não conta para a nota final. Fica feito quando o aluno o termina.')}</Hint>
            {l.evaluation === 'quiz' ? (
                <QuestionsEditor owner={l} set={set} graded={false} idPrefix={id} />
            ) : (
                <>
                    <Field label={t('O que o aluno tem de fazer')} id={`${id}-task`} required className="mb-3">
                        <textarea id={`${id}-task`} rows={5} className={inputCls} value={l.body ?? ''}
                            placeholder={t('Ex.: na tua oficina, identifica o compressor, o condensador e a válvula de expansão.')}
                            onChange={(e) => set((x) => { x.body = e.target.value; })} />
                    </Field>
                    {attachments}
                </>
            )}
        </div>
    );
}

export function RoleplayEditor({ l, set, canAlex, id }) {
    return (
        <div>
            <Hint>{t('O aluno conversa com o avatar numa situação real. Gasta os minutos de avatar do curso.')}</Hint>
            <PersonaField id={id} canAlex={canAlex} what={t('do roleplay')} value={l.evaluation_pal_id}
                onChange={(v) => set((x) => { x.evaluation_pal_id = v; })} />
            <Field label={t('Papel do avatar (o aluno vê)')} id={`${id}-role`} required className="mb-3">
                <input id={`${id}-role`} className={inputCls} value={l.roleplay_role ?? ''} maxLength={255}
                    placeholder={t('Ex.: cliente que acha a fatura do ar condicionado cara')}
                    onChange={(e) => set((x) => { x.roleplay_role = e.target.value; })} />
            </Field>
            <Field label={t('Situação para o aluno (o aluno lê antes de começar)')} id={`${id}-brief`} required className="mb-3">
                <textarea id={`${id}-brief`} rows={4} className={inputCls} value={l.body ?? ''}
                    placeholder={t('Ex.: és o rececionista da oficina. O cliente chega irritado com o valor da recarga…')}
                    onChange={(e) => set((x) => { x.body = e.target.value; })} />
            </Field>
            <ExtraInstruction id={id} value={l.evaluation_prompt} placeholder={t('Ex.: nesta versão, o cliente é mais calmo.')}
                onChange={(v) => set((x) => { x.evaluation_prompt = v; })} />
            <label className="flex items-center gap-2 text-[13.5px]">
                <input type="checkbox" checked={!!l.graded} className="text-accent focus:ring-ink" onChange={(e) => set((x) => { x.graded = e.target.checked; })} />
                {t('Tem nota (a nota vem da plataforma dos avatares)')}
            </label>
        </div>
    );
}
