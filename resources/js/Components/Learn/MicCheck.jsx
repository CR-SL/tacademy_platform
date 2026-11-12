import { useEffect, useRef, useState } from 'react';
import { t } from '@/i18n';

// Testar o microfone antes da avaliação (2026-11-11): o aluno fala e vê o nível a mexer.
// Nada é gravado nem enviado; o microfone desliga ao parar, ao continuar ou ao fechar.
export default function MicCheck() {
    const [state, setState] = useState('idle'); // idle | asking | on | heard | denied | none
    const [level, setLevel] = useState(0);
    const live = useRef(null);

    const stop = () => {
        const l = live.current;
        if (!l) return;
        cancelAnimationFrame(l.raf);
        l.stream.getTracks().forEach((tr) => tr.stop());
        l.ctx.close().catch(() => {});
        live.current = null;
    };
    useEffect(() => stop, []);

    const start = async () => {
        if (!navigator.mediaDevices?.getUserMedia) { setState('none'); return; }
        setState('asking');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 512;
            ctx.createMediaStreamSource(stream).connect(analyser);
            const data = new Uint8Array(analyser.fftSize);
            live.current = { stream, ctx, raf: 0 };
            setState('on');
            const tick = () => {
                analyser.getByteTimeDomainData(data);
                let sum = 0;
                for (const v of data) sum += ((v - 128) / 128) ** 2;
                const l = Math.min(1, Math.sqrt(sum / data.length) * 4);
                setLevel(l);
                if (l > 0.25) setState('heard');
                if (live.current) live.current.raf = requestAnimationFrame(tick);
            };
            tick();
        } catch (e) {
            setState(e?.name === 'NotFoundError' ? 'none' : 'denied');
        }
    };
    const toggle = () => {
        if (live.current) { stop(); setLevel(0); setState('idle'); } else start();
    };

    const running = state === 'on' || state === 'heard';
    const msg = {
        idle: t('Testa o microfone antes de começar. O tempo só conta depois de carregares em Continuar.'),
        asking: t('Autoriza o microfone no aviso do browser.'),
        on: t('Diz qualquer coisa em voz alta…'),
        heard: t('O microfone está a funcionar.'),
        denied: t('O browser não deu acesso ao microfone. Autoriza-o no cadeado ao lado do endereço, ou responde por escrito.'),
        none: t('Não encontrámos nenhum microfone. Podes responder por escrito.'),
    }[state];
    const bars = 12;
    const lit = Math.round(level * bars);

    return (
        <div className={`al-mic ${state}`}>
            {/* Só o ícone (2026-11-12); o nome fica para o leitor de ecrã e na dica */}
            <button type="button" className="al-mic-b" aria-pressed={running} onClick={toggle} disabled={state === 'asking'}
                aria-label={running ? t('Parar o teste') : t('Testar o microfone')} title={running ? t('Parar o teste') : t('Testar o microfone')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
                </svg>
            </button>
            {running && (
                <span className="al-mic-m" aria-hidden="true">
                    {Array.from({ length: bars }, (_, i) => <i key={i} className={i < lit ? 'on' : ''} />)}
                </span>
            )}
            <p className="al-mic-t" role="status">{state === 'heard' && '✓ '}{msg}</p>
        </div>
    );
}
