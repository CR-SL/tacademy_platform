import { useState } from 'react';

// Perguntas rápidas do fim do vídeo: responder é obrigatório, acertar não. Cada pergunta só se responde uma vez.
export default function QuickChecks({ lessonUlid, checks, canSave, onChange }) {
    const [items, setItems] = useState(checks);
    const [busy, setBusy] = useState(null);

    const answer = async (c, i) => {
        if (c.chosen != null || busy) return;
        setBusy(c.id);
        let result = { chosen: i, correct: null, explanation: null };
        if (canSave) {
            try {
                const r = await window.axios.post(`/plataforma/aulas/${lessonUlid}/perguntas/${c.id}`, { answer: i });
                result = r.data;
            } catch {
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
                    <div className="flex flex-col gap-1.5" role="group" aria-label={`Pergunta ${qi + 1}`}>
                        {c.options.map((o, i) => {
                            const answered = c.chosen != null;
                            const right = answered && c.correct === i;
                            const wrong = answered && c.chosen === i && c.correct !== i;
                            return (
                                <button
                                    key={i}
                                    type="button"
                                    disabled={answered || busy === c.id}
                                    onClick={() => answer(c, i)}
                                    className={`ta-cut-8 flex items-center gap-2 border-[1.5px] px-3 py-2.5 text-left text-[15px] transition-colors ${
                                        right ? 'border-[#2F9E5B] bg-[#2F9E5B14]' : wrong ? 'border-live bg-live/10' : answered ? 'border-transparent bg-page text-muted' : 'border-transparent bg-page hover:border-accent'
                                    }`}
                                >
                                    <span className="flex-1">{o}</span>
                                    {right && <span className="font-mono text-[11px] font-semibold text-[#2F9E5B]">✓ CERTA</span>}
                                    {wrong && <span className="font-mono text-[11px] font-semibold text-live">✗ A TUA RESPOSTA</span>}
                                </button>
                            );
                        })}
                    </div>
                    {c.chosen != null && c.explanation && (
                        <p className="mt-2 border-l-[3px] border-accent bg-page px-3 py-2 text-sm">{c.explanation}</p>
                    )}
                </div>
            ))}
        </div>
    );
}
