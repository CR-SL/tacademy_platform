import { useState } from 'react';

import { t } from '@/i18n';

// Perguntas rápidas do fim do vídeo: são opcionais e não contam para a nota. Cada pergunta só se responde uma vez.
export default function QuickChecks({ lessonUlid, checks, canSave, onChange, onCompleted }) {
    const [items, setItems] = useState(checks);
    const [busy, setBusy] = useState(null);
    const [failed, setFailed] = useState(null); // id da pergunta cuja resposta não foi guardada

    const answer = async (c, i) => {
        if (c.chosen != null || busy) return;
        setBusy(c.id);
        setFailed(null);
        let result = { chosen: i, correct: null, explanation: null };
        if (canSave) {
            try {
                const r = await window.axios.post(`/plataforma/aulas/${lessonUlid}/perguntas/${c.id}`, { answer: i });
                result = r.data;
                if (r.data.completed) onCompleted?.();
            } catch {
                setFailed(c.id);
                setBusy(null);
                return;
            }
        }
        const next = items.map((x) => (x.id === c.id ? { ...x, ...result } : x));
        setItems(next);
        onChange?.(next);
        setBusy(null);
    };

    return (
        <div className="flex flex-col gap-4">
            {items.map((c, qi) => (
                <div key={c.id}>
                    <p className="mb-2 font-display font-semibold">{qi + 1}. {c.question}</p>
                    <div className="flex flex-col gap-1.5" role="group" aria-label={t('Pergunta :v1', { v1: qi + 1 })}>
                        {c.options.map((o, i) => {
                            const answered = c.chosen != null;
                            // Sem a resposta certa (aula de amostra, pré-visualização) mostra só a escolha, sem certo/errado
                            const known = answered && c.correct != null;
                            const right = known && c.correct === i;
                            const wrong = known && c.chosen === i && c.correct !== i;
                            const picked = answered && !known && c.chosen === i;
                            return (
                                <button
                                    key={i}
                                    type="button"
                                    disabled={answered || busy === c.id}
                                    onClick={() => answer(c, i)}
                                    className={`rounded-full flex items-center gap-2 border-[1.5px] px-3 py-2.5 text-left text-[15px] transition-colors ${
                                        right ? 'border-success bg-success/10' : wrong ? 'border-live bg-live/10' : picked ? 'border-ink bg-page' : answered ? 'border-transparent bg-page text-muted' : 'border-transparent bg-page hover:border-accent'
                                    }`}
                                >
                                    <span className="flex-1">{o}</span>
                                    {picked && <span className="font-mono text-[11px] font-semibold uppercase text-muted">{t('A tua escolha')}</span>}
                                    {right && <span className="font-mono text-[11px] font-semibold uppercase text-success-ink"><span aria-hidden="true">✓ </span>{t('Certa')}</span>}
                                    {wrong && <span className="font-mono text-[11px] font-semibold uppercase text-live-ink"><span aria-hidden="true">✗ </span>{t('A tua resposta')}</span>}
                                </button>
                            );
                        })}
                    </div>
                    {failed === c.id && (
                        <p role="alert" className="mt-2 text-[13px] text-live-ink">{t('Não foi possível guardar a resposta. Verifica a ligação e tenta outra vez.')}</p>
                    )}
                    {c.chosen != null && c.explanation && (
                        <p className="mt-2 border-l-[3px] border-accent bg-page px-3 py-2 text-sm">{c.explanation}</p>
                    )}
                </div>
            ))}
        </div>
    );
}
