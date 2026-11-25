import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { t } from '@/i18n';

// Guia do editor de cursos (opção D, 2026-11-25): balões passo a passo por cima do que explicam.
// steps: [{ target: valor de data-guide, title, body, before?: () => void }]
export default function EditorGuide({ steps, onClose }) {
    const [i, setI] = useState(0);
    const [box, setBox] = useState(null);
    const next = useRef(null);
    const step = steps[i];

    // Prepara o passo (ex.: abre a primeira aula) antes de procurar o que destacar
    useEffect(() => { step?.before?.(); }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

    const measure = useCallback(() => {
        const el = document.querySelector(`[data-guide="${step?.target}"]`);
        setBox(el ? el.getBoundingClientRect() : null);
    }, [step]);

    useLayoutEffect(() => {
        const el = document.querySelector(`[data-guide="${step?.target}"]`);
        if (el) el.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        // A aula pode abrir só depois do primeiro desenho: volta a medir
        const id = setTimeout(measure, 350);
        measure();
        return () => clearTimeout(id);
    }, [i, measure]);

    useEffect(() => {
        window.addEventListener('scroll', measure, true);
        window.addEventListener('resize', measure);
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('scroll', measure, true);
            window.removeEventListener('resize', measure);
            document.removeEventListener('keydown', onKey);
        };
    }, [measure, onClose]);

    useEffect(() => { next.current?.focus(); }, [i]);

    if (!step) return null;
    const last = i === steps.length - 1;
    const pad = 6;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(320, vw - 32);
    // O balão vai por baixo do que destaca; se não couber, por cima
    const below = !box || box.bottom + 210 < vh;
    const top = !box ? vh / 2 - 90 : below ? box.bottom + pad + 10 : Math.max(12, box.top - pad - 10 - 190);
    const left = !box ? (vw - width) / 2 : Math.max(16, Math.min(box.left, vw - width - 16));

    return createPortal(
        <div className="fixed inset-0 z-[70]" aria-live="polite">
            {/* Fundo escuro com um "buraco" à volta do que o passo explica */}
            <button type="button" aria-label={t('Fechar o guia')} className="absolute inset-0 cursor-default" onClick={onClose} style={box ? undefined : { background: 'rgba(17,17,17,.35)' }} />
            {box && (
                <div aria-hidden="true" className="pointer-events-none absolute transition-all duration-200 motion-reduce:transition-none"
                    style={{
                        top: box.top - pad, left: box.left - pad, width: box.width + pad * 2, height: box.height + pad * 2,
                        boxShadow: '0 0 0 4px var(--color-accent), 0 0 0 9999px rgba(17,17,17,.35)',
                    }} />
            )}
            <div role="dialog" aria-modal="true" aria-labelledby="guia-t" className="absolute bg-ink p-4 text-on-ink shadow-[0_12px_30px_rgba(0,0,0,.25)]"
                style={{ top, left, width }}>
                <small className="font-display text-xs font-bold text-accent">{t('Passo :n de :total', { n: i + 1, total: steps.length })}</small>
                <h4 id="guia-t" className="mb-1.5 mt-1 font-display text-base font-bold">{step.title}</h4>
                <p className="mb-3.5 text-[13.5px] opacity-85">{step.body}</p>
                <div className="flex items-center gap-3">
                    <button type="button" onClick={onClose} className="font-display text-[13px] font-bold opacity-70 hover:opacity-100">{t('Saltar')}</button>
                    {i > 0 && <button type="button" onClick={() => setI(i - 1)} className="font-display text-[13px] font-bold">{t('← Anterior')}</button>}
                    <button ref={next} type="button" onClick={() => (last ? onClose() : setI(i + 1))}
                        className="ml-auto bg-accent px-3.5 py-2 font-display text-[13px] font-bold text-on-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                        {last ? t('Concluir') : t('Seguinte →')}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
