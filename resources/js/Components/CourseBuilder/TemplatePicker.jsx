import { Link } from '@inertiajs/react';
import { useState } from 'react';
import { MODELS, PART_LABELS, outline } from './templates';

import { t } from '@/i18n';

const ICON = { video: '▶', material: 'PDF', notas: 'Aa', avatar: 'IA' };
const EVAL = { quiz: 'Questionário', avatar: 'Avaliação com o Alex' };

function Stepper({ label, value, onChange }) {
    return (
        <div className="flex items-center justify-between gap-3 border-t border-line py-2.5">
            <span className="font-display text-[13.5px] font-semibold">{label}</span>
            <span className="flex items-center bg-page" role="group" aria-label={label}>
                <button type="button" className="h-9 w-9 font-display text-lg font-bold hover:bg-surface2 disabled:opacity-30" disabled={value <= 1}
                    aria-label={t('Menos')} onClick={() => onChange(value - 1)}>−</button>
                <output aria-live="polite" className="w-8 text-center font-display font-extrabold">{value}</output>
                <button type="button" className="h-9 w-9 font-display text-lg font-bold hover:bg-surface2 disabled:opacity-30" disabled={value >= 10}
                    aria-label={t('Mais')} onClick={() => onChange(value + 1)}>+</button>
            </span>
        </div>
    );
}

// Primeiro ecrã de "Criar curso" (2026-11-26): o formador escolhe um modelo e quantos módulos e aulas;
// o editor abre com o programa montado. "Em branco" começa como antes.
export default function TemplatePicker({ onStart }) {
    const [pick, setPick] = useState('video');
    const [modules, setModules] = useState(3);
    const [lessons, setLessons] = useState(3);
    const model = MODELS.find((m) => m.id === pick) ?? null;
    const prog = outline(model, modules, lessons);
    const count = prog.reduce((a, m) => a + m.lessons.length, 0);

    const card = (selected) => `relative flex flex-col gap-2.5 border-[1.5px] bg-surface p-[18px] text-left transition-[border-color,box-shadow] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
        selected ? 'border-ink shadow-[0_0_0_3px_rgb(248_177_1_/_0.35)]' : 'border-transparent hover:border-line'
    }`;

    return (
        <div>
            <Link href="/formador/cursos" className="font-display text-[13px] font-semibold text-muted hover:text-ink">{t('← Os meus cursos')}</Link>
            <h1 className="mb-1.5 mt-2.5 font-display text-[30px] font-bold leading-tight tracking-[-0.015em]">{t('Como vai ser o teu curso?')}</h1>
            <p className="mb-6 max-w-[640px] text-muted">{t('Escolhe o modelo mais parecido. O programa aparece montado e só tens de preencher. Depois podes mudar tudo.')}</p>

            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
                <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label={t('Modelos de curso')}>
                    {MODELS.map((m) => (
                        <button key={m.id} type="button" aria-pressed={pick === m.id} onClick={() => setPick(m.id)} className={card(pick === m.id)}>
                            {m.tag && <span className="absolute right-3.5 top-3.5 bg-ink px-2 py-0.5 font-display text-[11px] font-bold text-on-ink">{t(m.tag)}</span>}
                            <span className="flex items-center gap-3 pr-16">
                                <span aria-hidden="true" className={`grid h-[42px] w-[42px] flex-none place-items-center font-display text-[13px] font-extrabold ${pick === m.id ? 'bg-accent text-on-accent' : 'bg-surface2'}`}>{m.icon}</span>
                                <span>
                                    <b className="block font-display text-base">{t(m.name)}</b>
                                    <small className="text-[12.5px] text-muted">{t(m.for)}</small>
                                </span>
                            </span>
                            <span className="flex flex-wrap gap-1.5">
                                {m.parts.map((p) => <span key={p} className="bg-page px-2 py-0.5 text-[11.5px] font-semibold">{t(PART_LABELS[p])}</span>)}
                                <span className="bg-accent/20 px-2 py-0.5 text-[11.5px] font-semibold text-accent-ink">{t(m.evaluation)}</span>
                            </span>
                            <span className="border-t border-line pt-2 text-[12.5px] text-muted">{t(m.example)}</span>
                        </button>
                    ))}
                    <button type="button" aria-pressed={pick === 'blank'} onClick={() => setPick('blank')} className={`${card(pick === 'blank')} sm:col-span-2 !flex-row items-center`}>
                        <span aria-hidden="true" className="grid h-[42px] w-[42px] flex-none place-items-center border-[1.5px] border-dashed border-line font-display text-lg font-bold">+</span>
                        <span>
                            <b className="block font-display text-base">{t('Em branco')}</b>
                            <small className="text-[12.5px] text-muted">{t('Começa com um módulo e uma aula vazios e monta tudo à tua maneira.')}</small>
                        </span>
                    </button>
                </div>

                <aside className="bg-surface p-5 lg:sticky lg:top-[90px]">
                    <h2 className="font-display text-[17px] font-bold">{model ? t(model.name) : t('Em branco')}</h2>
                    <small className="mb-3.5 block text-[12.5px] text-muted">
                        {model
                            ? t(':n aulas · :alex', { n: count, alex: model.alex ? t('com o Alex') : t('sem avatar') })
                            : t('1 módulo · 1 aula')}
                    </small>
                    {model ? (
                        <>
                            <Stepper label={t('Quantos módulos?')} value={modules} onChange={setModules} />
                            <Stepper label={t('Aulas por módulo?')} value={lessons} onChange={setLessons} />
                            <div className="my-3 max-h-[330px] overflow-auto border border-line">
                                {prog.map((m, mi) => (
                                    <div key={mi}>
                                        <div className="flex gap-2 bg-page px-3 py-2 font-display text-[12.5px] font-bold">
                                            <span className="text-accent-ink">{m.final ? '★' : String(mi + 1).padStart(2, '0')}</span>
                                            {m.final ? t('Teste final') : t('Módulo :n', { n: mi + 1 })}
                                        </div>
                                        {m.lessons.map((l, li) => (
                                            <div key={li} className="flex items-center gap-2 border-t border-line px-3 py-1.5 text-[12.5px]">
                                                <span aria-hidden="true" className={`grid h-[22px] w-[22px] flex-none place-items-center rounded-full text-[9px] font-extrabold ${l.parts.length ? 'bg-ink text-on-ink' : 'bg-accent text-on-accent'}`}>
                                                    {l.parts.length ? ICON[l.parts[0]] : '?'}
                                                </span>
                                                {m.final ? t('Teste final') : t('Aula :n', { n: `${mi + 1}.${li + 1}` })}
                                                <em className="ml-auto truncate pl-2 text-[11.5px] not-italic text-muted">
                                                    {[...l.parts.map((p) => t(PART_LABELS[p])), l.evaluation !== 'none' && t(EVAL[l.evaluation])].filter(Boolean).join(' · ')}
                                                </em>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <p className="mb-4 text-[13px] text-muted">{t('Começas como antes: um módulo com uma aula de vídeo. Liga em cada aula o que precisares.')}</p>
                    )}
                    <button type="button" onClick={() => onStart(model?.id ?? null, modules, lessons)} className="ui-btn ui-btn-accent w-full justify-center">
                        {model ? t('Começar com este modelo →') : t('Começar em branco →')}
                    </button>
                    {model?.alex && <p className="mt-2.5 text-[12.5px] text-muted">{t('O Alex fica ligado no curso. Se o teu perfil não puder ligar o avatar, o editor avisa no passo 3.')}</p>}
                    <p className="mt-2.5 text-[12.5px] text-muted">{t('Os nomes das aulas, as partes e as avaliações mudam-se depois no editor.')}</p>
                </aside>
            </div>
        </div>
    );
}
