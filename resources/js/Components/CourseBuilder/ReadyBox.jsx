import { lessonMissing, questionsReady } from './model';

import { t } from '@/i18n';

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Lista do que falta para publicar, na coluna do editor (2026-11-26, opção D): anel com a percentagem,
// o que já está feito riscado e "Fazer →" a levar ao passo (e à aula) certos.
export function readyItems(c, shortMax, previewed) {
    const lessons = c.modules.flatMap((m, mi) => m.lessons.map((l, li) => ({ n: `${mi + 1}.${li + 1}`, l, miss: lessonMissing(l) })));
    const todo = lessons.filter((x) => x.miss.length);
    const items = [
        {
            id: 'info', step: 0, label: t('Nome, área e capa do curso'),
            ok: !!c.title.trim() && !!c.category_id && !!c.level && !!c.thumbnail_url && !!c.short_description.trim() && c.short_description.length <= shortMax,
        },
        { id: 'modules', step: 1, label: t('Módulos e atividades'), ok: lessons.length > 0 && c.modules.every((m) => m.title.trim()) },
    ];
    // As aulas que faltam (as 2 primeiras); sem nenhuma em falta, uma linha feita
    if (lessons.length && !todo.length) items.push({ id: 'lessons', step: 1, label: t('Completar as atividades'), ok: true });
    todo.slice(0, 2).forEach((x) => items.push({
        id: `l-${x.l.key}`, step: 1, lesson: x.l.key, ok: false,
        label: t(':what · atividade :n', { what: cap(x.miss[0]), n: x.n }),
    }));
    if (todo.length > 2) items.push({ id: 'more', step: 1, lesson: todo[2].l.key, ok: false, label: t('Mais :n atividades por completar', { n: todo.length - 2 }) });
    // Avaliação final (passo 4): com perguntas, têm de estar prontas
    if (c.final_mode === 'questions') items.push({ id: 'final', step: 3, label: t('Perguntas da avaliação final'), ok: questionsReady(c.final_quiz) });
    items.push({ id: 'price', step: 4, label: t('Preço e acesso'), ok: c.is_free || Number(c.price) > 0 });
    // Opcional (2026-11-26): não conta para a percentagem nem impede o curso de ficar pronto
    items.push({ id: 'preview', step: 5, label: t('Ver como aluno'), ok: previewed, optional: true });
    return items;
}

export default function ReadyBox({ items, onDo }) {
    const counted = items.filter((i) => !i.optional);
    const done = counted.filter((i) => i.ok).length;
    const pct = counted.length ? Math.round((done / counted.length) * 100) : 0;
    const left = counted.length - done;
    const next = counted.find((i) => !i.ok);
    const r = 24;
    const len = 2 * Math.PI * r;

    return (
        <div data-guide="ready-side" className="mt-3.5 hidden border-t border-line pt-4 lg:block">
            <div className="mb-3 flex items-center gap-3.5">
                <svg viewBox="0 0 60 60" className="h-[60px] w-[60px] flex-none -rotate-90" aria-hidden="true">
                    <circle cx="30" cy="30" r={r} fill="none" strokeWidth="7" className="stroke-surface2" />
                    <circle cx="30" cy="30" r={r} fill="none" strokeWidth="7" strokeLinecap="round" className="stroke-accent transition-[stroke-dashoffset] duration-500 motion-reduce:transition-none"
                        strokeDasharray={len} strokeDashoffset={len * (1 - pct / 100)} />
                </svg>
                <div>
                    <b className="block font-display text-[17px] font-bold leading-tight">{t(':pct% pronto', { pct })}</b>
                    <small className="text-[12.5px] text-muted">
                        {left === 0 ? t('Pronto para publicar') : left === 1 ? t('Falta 1 coisa para publicar') : t('Faltam :n coisas para publicar', { n: left })}
                    </small>
                </div>
            </div>
            <ul>
                {items.map((i) => {
                    const current = i === next;
                    return (
                        <li key={i.id} className="flex items-center gap-2.5 border-t border-line py-2.5 text-[13.5px] first:border-t-0">
                            <span aria-hidden="true" className={`grid h-5 w-5 flex-none place-items-center rounded-full text-[11px] font-bold ${
                                i.ok ? 'bg-success text-white' : current ? 'border-2 border-accent bg-accent/15' : 'border border-line'
                            }`}>{i.ok ? '✓' : ''}</span>
                            <span className={`min-w-0 flex-1 ${i.ok ? 'text-muted line-through' : current ? 'font-semibold' : ''}`}>
                                {i.label}
                                {i.optional && <small className="ml-1 text-[11.5px] font-normal text-muted">{t('(opcional)')}</small>}
                                {i.ok && <span className="sr-only">{t(' (feito)')}</span>}
                            </span>
                            {!i.ok && (
                                <button type="button" onClick={() => onDo(i)} className="flex-none font-display text-[13px] font-semibold text-accent-ink hover:text-ink">
                                    {t('Fazer →')}
                                </button>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
