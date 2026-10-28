import { useEffect, useState } from 'react';
import QuickChecks from './QuickChecks';

const TABS = [['ia', 'IA'], ['perguntas', 'Perguntas'], ['notas', 'Notas']];

// Painel da direita na página da aula: IA (avatar do curso por link), perguntas rápidas e notas.
// O iframe do avatar só carrega quando o aluno abre o separador IA, e nessa altura o vídeo pausa.
export default function Assistant({ avatarUrl, lessonUlid, checks, setChecks, hasChecks, checksOpen, remaining, canSave, isQuiz, onAskAi }) {
    const [tab, setTab] = useState('perguntas');
    const [aiStarted, setAiStarted] = useState(false);
    const unanswered = checks.filter((c) => c.chosen == null).length;

    const open = (t) => {
        setTab(t);
        if (t === 'ia' && avatarUrl) {
            setAiStarted(true);
            onAskAi?.();
        }
    };

    // Quando o vídeo chega aos 90%, as perguntas aparecem (se o aluno não estiver a falar com a IA)
    useEffect(() => {
        if (checksOpen && hasChecks) setTab((t) => (t === 'ia' ? t : 'perguntas'));
    }, [checksOpen, hasChecks]);

    return (
        <aside className="ta-cut-12 flex flex-col bg-surface lg:sticky lg:top-[90px] lg:max-h-[calc(100vh-110px)]">
            <div role="tablist" className="grid flex-none grid-cols-3 border-b border-line">
                {TABS.map(([key, label]) => (
                    <button
                        key={key}
                        type="button"
                        role="tab"
                        aria-selected={tab === key}
                        onClick={() => open(key)}
                        className={`flex items-center justify-center gap-1.5 border-b-[3px] px-2 py-3 font-display text-[13px] font-semibold uppercase tracking-[0.03em] ${
                            tab === key ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'
                        }`}
                    >
                        {key === 'ia' && <span className="h-3 w-3 rounded-full bg-[radial-gradient(circle_at_35%_35%,#FFE08A,#F8B101_55%,#946A00)]" aria-hidden="true" />}
                        {label}
                        {key === 'perguntas' && checksOpen && unanswered > 0 && (
                            <span className="bg-accent px-1.5 font-mono text-[11px] text-on-accent">{unanswered}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* IA: fica montada depois de aberta, para não perder a conversa ao trocar de separador */}
            <div className={`min-h-0 flex-1 flex-col ${tab === 'ia' ? 'flex' : 'hidden'}`}>
                {avatarUrl ? (
                    aiStarted && (
                        <>
                            <iframe src={avatarUrl} title="Perguntar à IA" className="h-[460px] w-full flex-1 border-0 bg-ink lg:h-auto lg:min-h-[420px]" allow="microphone; camera; autoplay" />
                            <div className="flex flex-none items-center justify-between gap-2 border-t border-line px-3.5 py-2.5 text-xs text-muted">
                                O vídeo fica em pausa enquanto falas.
                                <a href={avatarUrl} target="_blank" rel="noopener noreferrer" className="font-display text-[13px] font-semibold text-accent-ink hover:text-ink">Abrir numa janela nova ↗</a>
                            </div>
                        </>
                    )
                ) : (
                    <p className="p-4 text-sm text-muted">Este curso ainda não tem IA para tirar dúvidas.</p>
                )}
            </div>

            {tab === 'perguntas' && (
                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                    {hasChecks ? (
                        checksOpen ? (
                            <>
                                <p className="mb-4 text-sm text-muted">Responde a todas para concluir a aula. Não contam para a nota.</p>
                                <QuickChecks lessonUlid={lessonUlid} checks={checks} canSave={canSave} onChange={setChecks} />
                            </>
                        ) : (
                            <p className="ta-cut-8 bg-page px-4 py-3 text-sm text-muted">🔒 As perguntas aparecem quando vires o vídeo até ao fim (faltam {remaining}).</p>
                        )
                    ) : (
                        <p className="text-sm text-muted">{isQuiz ? 'Esta aula é o teste — responde às perguntas ao centro.' : 'Esta aula não tem perguntas rápidas.'}</p>
                    )}
                </div>
            )}

            {tab === 'notas' && (
                <div className="p-4">
                    <textarea disabled placeholder="As tuas notas desta aula…" aria-label="Notas" className="min-h-[200px] w-full resize-none border-0 bg-page p-3 text-sm shadow-[inset_0_0_0_1px_var(--color-line)]" />
                    <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.08em] text-muted">Em breve</p>
                </div>
            )}
        </aside>
    );
}
