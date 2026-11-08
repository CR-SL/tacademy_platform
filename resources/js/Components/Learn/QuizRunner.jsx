import { router } from '@inertiajs/react';
import { useState } from 'react';

// Teste: até N tentativas. Depois de entregar, vê-se a nota e quais acertou/errou (sem poder alterar).
// As respostas certas só aparecem quando o teste fica fechado (passou ou esgotou as tentativas).
export default function QuizRunner({ lessonUlid, quiz, canSave }) {
    const last = quiz.attempts[quiz.attempts.length - 1];
    const [retrying, setRetrying] = useState(!last);
    const [answers, setAnswers] = useState({});
    const [busy, setBusy] = useState(false);
    const used = quiz.attempts.length;
    const left = quiz.max - used;
    const best = used ? Math.max(...quiz.attempts.map((a) => a.score)) : null;
    const all = quiz.questions.every((q) => answers[q.id] != null);

    const submit = () => {
        setBusy(true);
        router.post(`/plataforma/aulas/${lessonUlid}/quiz`, { answers }, {
            preserveScroll: false,
            onSuccess: () => { setRetrying(false); setAnswers({}); window.scrollTo({ top: 0 }); },
            onFinish: () => setBusy(false),
        });
    };

    const meta = (
        <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
            <span>Nota mínima <b className="font-display text-ink">{quiz.passing}%</b></span>
            <span>Tentativas <b className="font-display text-ink">{used} / {quiz.max}</b></span>
            <span className="flex gap-1" aria-hidden="true">{Array.from({ length: quiz.max }, (_, i) => <i key={i} className={`h-1.5 w-6 ${i < used ? 'bg-ink' : 'bg-track'}`} />)}</span>
            {best != null && <span>Melhor nota <b className="font-display text-ink">{best}%</b></span>}
        </div>
    );

    if (!retrying && last) {
        return (
            <div className="p-5 sm:p-7">
                {meta}
                <div className={`mb-5 flex flex-wrap items-center gap-4 p-5 ${last.passed ? 'bg-success/10' : 'bg-live/10'}`}>
                    <span className={`font-display text-[40px] font-bold leading-none ${last.passed ? 'text-success-ink' : 'text-live-ink'}`}>{last.score}%</span>
                    <div>
                        <p className="font-display text-lg font-bold">{last.passed ? 'Passaste no teste!' : 'Ainda não chegaste à nota mínima'}</p>
                        <p className="text-sm text-muted">
                            Tentativa {used} de {quiz.max}.{' '}
                            {last.passed ? 'A aula ficou concluída.' : left > 0 ? `Tens mais ${left} tentativa${left > 1 ? 's' : ''}.` : 'Já usaste todas as tentativas. Fala com o formador.'}
                        </p>
                    </div>
                </div>
                {quiz.questions.map((q, qi) => {
                    const chosen = last.answers[q.id];
                    const ok = last.results[q.id];
                    return (
                        <div key={q.id} className="border-t border-line py-4 first:border-t-0">
                            <p className="mb-2 flex gap-2 font-display font-semibold">
                                <span className={ok ? 'text-success-ink' : 'text-live-ink'} aria-label={ok ? 'Certa' : 'Errada'}>{ok ? '✓' : '✗'}</span>
                                {qi + 1}. {q.question}
                            </p>
                            {q.options.map((o) => {
                                const mine = Number(chosen) === o.id;
                                const isRight = q.correct === o.id;
                                return (
                                    <div key={o.id} className={`mb-1.5 flex items-center gap-2 border-[1.5px] px-3 py-2.5 text-[15px] ${
                                        isRight ? 'border-success bg-success/10' : mine ? (ok ? 'border-success bg-success/10' : 'border-live bg-live/10') : 'border-transparent bg-page text-muted'
                                    }`}>
                                        <span className="flex-1">{o.text}</span>
                                        {mine && <span className={`font-mono text-[11px] font-semibold uppercase ${ok ? 'text-success-ink' : 'text-live-ink'}`}><span aria-hidden="true">{ok ? '✓ ' : '✗ '}</span>A tua resposta</span>}
                                        {isRight && !mine && <span className="font-mono text-[11px] font-semibold uppercase text-success-ink"><span aria-hidden="true">✓ </span>Certa</span>}
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
                <p className="mt-2 text-[13px] text-muted">
                    As respostas e a nota ficam registadas e não podem ser alteradas.
                    {!quiz.passed && left > 0 && ' As respostas certas aparecem quando passares ou esgotares as tentativas.'}
                </p>
                {!quiz.passed && left > 0 && canSave && (
                    <button type="button" onClick={() => setRetrying(true)} className="ui-btn mt-4">
                        Tentar outra vez
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="p-5 sm:p-7">
            {meta}
            {quiz.questions.map((q, qi) => (
                <fieldset key={q.id} className="border-t border-line py-4 first:border-t-0">
                    <legend className="mb-2 font-display font-semibold">{qi + 1}. {q.question}</legend>
                    {q.options.map((o) => (
                        <label key={o.id} className={`mb-1.5 flex cursor-pointer items-center gap-2.5 border-[1.5px] px-3 py-2.5 text-[15px] ${
                            answers[q.id] === o.id ? 'border-accent bg-accent/10' : 'border-transparent bg-page hover:border-line'
                        }`}>
                            <input type="radio" name={`q${q.id}`} className="text-accent focus:ring-accent" checked={answers[q.id] === o.id}
                                onChange={() => setAnswers({ ...answers, [q.id]: o.id })} />
                            {o.text}
                        </label>
                    ))}
                </fieldset>
            ))}
            {canSave ? (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button type="button" disabled={!all || busy} onClick={submit}
                        className="ui-btn ui-btn-accent">
                        {busy ? 'A entregar…' : 'Entregar respostas'}
                    </button>
                    <span className="text-[13px] text-muted">{all ? 'Depois de entregar não podes mudar as respostas.' : 'Responde a todas as perguntas para entregar.'}</span>
                </div>
            ) : (
                <p className="mt-3 text-[13px] text-muted">Pré-visualização: as respostas não são entregues.</p>
            )}
        </div>
    );
}
