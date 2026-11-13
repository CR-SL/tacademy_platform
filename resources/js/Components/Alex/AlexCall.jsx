import { router, usePage } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { t } from '@/i18n';
import { dismissAlex, endAlex, isActive, startAlex, toggleCam, toggleMic, useAlexCall } from './alexStore';
import '../../../css/alex.css';

const S = ({ children }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
const IconMic = () => <S><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></S>;
const IconMicOff = () => <S><path d="M15 10V6a3 3 0 0 0-5.7-1.3M9 9v2a3 3 0 0 0 4.6 2.5M5 11a7 7 0 0 0 11.4 5.4M19 11c0 .9-.2 1.8-.5 2.6M12 18v3M4 4l16 16" /></S>;
const IconCam = () => <S><rect x="3" y="6" width="13" height="12" rx="2" /><path d="M16 10l5-3v10l-5-3z" /></S>;
const IconCamOff = () => <S><path d="M16 16v1a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2M11 6h4a1 1 0 0 1 1 1v3l5-3v10M3 3l18 18" /></S>;

const PLACE = { inicio: 'Início', avaliacoes: 'Avaliações', aula: 'Aula' };

// A janela do Alex: o aluno move-a pelo cabeçalho e muda-lhe o tamanho pelo canto de cima à esquerda.
// A posição conta a partir do canto de baixo à direita (r, b). Fica guardada neste browser e nunca sai do ecrã.
// Duplo clique no cabeçalho repõe o lugar; duplo clique no canto repõe o tamanho.
const BOX_KEY = 'ta-alex-janela';
const DEFAULT_BOX = { w: 380, h: 580, r: 16, b: 16 };
const MIN = { w: 300, h: 380 };
const GAP = 8; // margem mínima até às bordas do ecrã
// Área visível sem as barras de scroll (é a que conta para uma janela fixa)
const viewW = () => document.documentElement.clientWidth || window.innerWidth;
const viewH = () => document.documentElement.clientHeight || window.innerHeight;

function fit(box) {
    const vw = viewW();
    const vh = viewH();
    const w = Math.min(Math.max(box.w, MIN.w), Math.max(MIN.w, vw - 2 * GAP));
    const h = Math.min(Math.max(box.h, MIN.h), Math.max(MIN.h, vh - 2 * GAP));
    return {
        w: Math.round(w),
        h: Math.round(h),
        r: Math.round(Math.min(Math.max(box.r, GAP), Math.max(GAP, vw - w - GAP))),
        b: Math.round(Math.min(Math.max(box.b, GAP), Math.max(GAP, vh - h - GAP))),
    };
}
function readBox() {
    try {
        const v = JSON.parse(localStorage.getItem(BOX_KEY));
        return v && ['w', 'h'].every((k) => Number.isFinite(v[k])) ? { ...DEFAULT_BOX, ...v } : DEFAULT_BOX;
    } catch { return DEFAULT_BOX; }
}
function saveBox(v) {
    try { localStorage.setItem(BOX_KEY, JSON.stringify(v)); } catch { /* sem armazenamento: vale só nesta visita */ }
}

function useWindowBox() {
    const [box, setBox] = useState(() => fit(readBox()));
    // Se o browser ficar mais pequeno, a janela encolhe e volta para dentro do ecrã
    useEffect(() => {
        const onResize = () => setBox((v) => fit(v));
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);
    const change = (next) => setBox((prev) => { const v = fit(typeof next === 'function' ? next(prev) : next); saveBox(v); return v; });
    return [box, change];
}

// Arrastar com o rato ou o dedo: devolve a deslocação desde o início
function drag(e, cls, onMove) {
    if (e.button !== 0) return;
    e.preventDefault();
    const sx = e.clientX;
    const sy = e.clientY;
    const html = document.documentElement.classList;
    html.add(cls);
    const move = (ev) => onMove(ev.clientX - sx, ev.clientY - sy);
    const up = () => {
        html.remove(cls);
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
}

const ARROWS = { ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, -20], ArrowDown: [0, 20] };

function ResizeCorner({ box, onChange }) {
    // Puxar para a esquerda e para cima faz crescer; o canto de baixo à direita fica no sítio
    const down = (e) => {
        const start = box;
        drag(e, 'ax-resizing', (dx, dy) => onChange({
            ...start,
            w: Math.min(start.w - dx, viewW() - start.r - GAP),
            h: Math.min(start.h - dy, viewH() - start.b - GAP),
        }));
    };
    const key = (e) => {
        const d = ARROWS[e.key];
        if (!d) return;
        e.preventDefault();
        onChange((v) => ({ ...v, w: v.w - d[0], h: v.h - d[1] }));
    };
    return (
        <button type="button" className="ax-rs" onPointerDown={down} onKeyDown={key} onDoubleClick={() => onChange((v) => ({ ...v, w: DEFAULT_BOX.w, h: DEFAULT_BOX.h }))}
            aria-label={t('Redimensionar a janela do Alex. Usa as setas do teclado.')} title={t('Arrastar para redimensionar. Duplo clique repõe o tamanho.')}>
            <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M1 11V1h10M1 6h5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        </button>
    );
}

// Cabeçalho que move a janela; a pega à direita faz o mesmo com o teclado
function MoveHeader({ box, onChange, children }) {
    const down = (e) => {
        if (e.target.closest('button:not(.ax-grip)')) return;
        const start = box;
        drag(e, 'ax-moving', (dx, dy) => onChange({ ...start, r: start.r - dx, b: start.b - dy }));
    };
    const key = (e) => {
        const d = ARROWS[e.key];
        if (!d) return;
        e.preventDefault();
        onChange((v) => ({ ...v, r: v.r - d[0], b: v.b - d[1] }));
    };
    const reset = () => onChange((v) => ({ ...v, r: DEFAULT_BOX.r, b: DEFAULT_BOX.b }));
    return (
        <header className="ax-head" onPointerDown={down} onDoubleClick={reset}>
            {children}
            <button type="button" className="ax-grip" onKeyDown={key} aria-label={t('Mover a janela do Alex. Usa as setas do teclado.')}
                title={t('Arrastar para mover. Duplo clique repõe o lugar.')}>
                <svg viewBox="0 0 12 12" aria-hidden="true">{[[3, 3], [9, 3], [3, 6], [9, 6], [3, 9], [9, 9]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.2" fill="currentColor" />)}</svg>
            </button>
        </header>
    );
}
const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function Video({ track, className, mirror }) {
    const ref = useRef(null);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        el.srcObject = track ? new MediaStream([track]) : null;
    }, [track]);
    return <video ref={ref} className={`${className} ${mirror ? 'mirror' : ''}`} autoPlay playsInline muted />;
}

// Tempo que falta; aos 0:00 a conversa acaba (o Tavus fecha a sala ao mesmo tempo)
function TimeLeft({ endsAt }) {
    const left = () => Math.max(0, Math.round((new Date(endsAt).getTime() - Date.now()) / 1000));
    const [secs, setSecs] = useState(left);
    useEffect(() => {
        const id = setInterval(() => {
            const s = left();
            setSecs(s);
            if (s <= 0) { clearInterval(id); endAlex(); }
        }, 1000);
        return () => clearInterval(id);
    }, [endsAt]); // eslint-disable-line react-hooks/exhaustive-deps
    return <span className={`ax-time ${secs <= 120 ? 'low' : ''}`} aria-label={t('Faltam :time', { time: clock(secs) })}>{clock(secs)}</span>;
}

/** A conversa: vídeo do Alex, a tua câmara, microfone, câmara e Terminar. Igual na janela e no painel da aula. */
export function AlexCallView({ onClose }) {
    const s = useAlexCall();
    const busy = isActive(s);
    const note = {
        starting: t('A preparar a conversa…'),
        waiting: t('O Alex está a chegar…'),
        ended: t('Conversa terminada.'),
        error: s.error,
    }[s.status];

    return (
        <div className="ax-call">
            <div className="ax-stage">
                {s.alexVideo ? <Video track={s.alexVideo} className="ax-alex" /> : <img className="ax-alex ax-poster" src="/images/alex.png" alt="" />}
                {note && (
                    <div className={`ax-note ${s.status}`} role="status">
                        {busy && <span className="ax-dot" aria-hidden="true" />}
                        <span>{note}</span>
                    </div>
                )}
                {s.selfVideo && s.cam && <Video track={s.selfVideo} className="ax-self" mirror />}
                {s.conv?.endsAt && s.status === 'live' && <TimeLeft endsAt={s.conv.endsAt} />}
            </div>
            <div className="ax-bar">
                {busy ? (
                    <>
                        <button type="button" className={`ui-btn ui-btn-icon ${s.mic ? 'ui-btn-soft' : 'ui-btn-line'}`} aria-pressed={!s.mic}
                            aria-label={s.mic ? t('Desligar o microfone') : t('Ligar o microfone')} title={s.mic ? t('Desligar o microfone') : t('Ligar o microfone')}
                            disabled={s.status === 'starting'} onClick={toggleMic}>{s.mic ? <IconMic /> : <IconMicOff />}</button>
                        <button type="button" className={`ui-btn ui-btn-icon ${s.cam ? 'ui-btn-soft' : 'ui-btn-line'}`} aria-pressed={s.cam}
                            aria-label={s.cam ? t('Desligar a câmara') : t('Ligar a câmara')} title={s.cam ? t('Desligar a câmara') : t('Ligar a câmara')}
                            disabled={s.status === 'starting'} onClick={toggleCam}>{s.cam ? <IconCam /> : <IconCamOff />}</button>
                        <span className="ax-sp" />
                        <button type="button" className="ui-btn ui-btn-danger" onClick={endAlex}>{t('Terminar')}</button>
                    </>
                ) : (
                    <>
                        <span className="ax-left">{s.status === 'ended' && s.left > 0 ? t('Hoje ainda podes falar :n vezes com o Alex.', { n: s.left }) : ''}</span>
                        <span className="ax-sp" />
                        {onClose && <button type="button" className="ui-btn ui-btn-soft" onClick={onClose}>{t('Fechar')}</button>}
                    </>
                )}
            </div>
        </div>
    );
}

/**
 * Botão para começar (Início, Avaliações e painel da aula). Primeiro as conversas grátis do dia (cursos com o
 * avatar); depois 1 crédito por conversa; sem nenhuma das duas, a compra de créditos.
 */
export function AlexStart({ alex, block = true }) {
    const s = useAlexCall();
    const left = s.left ?? alex.left ?? 0;
    const credits = s.credits ?? alex.credits ?? 0;
    if (isActive(s)) {
        return <button type="button" className={`ui-btn ui-btn-line ${block ? 'ui-btn-block' : ''}`} disabled>{t('Conversa a decorrer')}</button>;
    }
    if (left <= 0 && credits <= 0) {
        return <AlexBuy alex={alex} lead={alex.free ? t('Já usaste as :n conversas grátis de hoje. Compra créditos para continuar a falar com o Alex.', { n: alex.perDay }) : t('Não tens créditos. Compra créditos para continuar a falar com o Alex.')} />;
    }
    return (
        <>
            <button type="button" className={`ui-btn ui-btn-accent ${block ? 'ui-btn-block' : ''}`}
                onClick={() => startAlex({ place: alex.place, lesson: alex.lesson })}>{t('Falar com o Alex')}</button>
            <p className="ax-hint">
                {left > 0
                    ? t('Até :m minutos por conversa. Hoje ainda tens :n grátis.', { m: alex.minutes, n: left })
                    : alex.free
                        ? t('Já usaste as conversas grátis de hoje. Esta gasta 1 crédito (tens :n).', { n: credits })
                        : t('Tens :n créditos. Cada conversa gasta 1 (até :m minutos).', { n: credits, m: alex.minutes })}
                {left > 0 && credits > 0 ? ` ${t('Tens também :n créditos.', { n: credits })}` : ''}
            </p>
        </>
    );
}

const euro = (v) => new Intl.NumberFormat(document.documentElement.lang || 'pt-PT', { style: 'currency', currency: 'EUR' }).format(v);

/** Compra de créditos de avatar (1 crédito = 1 conversa). Fica um pedido que o gestor de cursos autoriza. */
export function AlexBuy({ alex, lead }) {
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const buy = (credits) => router.post('/plataforma/alex/creditos', { credits }, {
        preserveScroll: true,
        onStart: () => setBusy(true),
        onFinish: () => { setBusy(false); setOpen(false); },
    });

    if (alex.pending) {
        return <p className="ax-hint">{t('A tua compra de :n créditos aguarda a autorização do gestor de cursos.', { n: alex.pending })}</p>;
    }
    return (
        <>
            {lead && <p className="ax-hint">{lead}</p>}
            {open ? (
                <div className="ax-packs" role="group" aria-label={t('Pacotes de créditos')}>
                    {(alex.packs || []).map((p) => (
                        <button key={p.credits} type="button" className="ax-pack" disabled={busy} onClick={() => buy(p.credits)}>
                            <b>{t(':n conversas', { n: p.credits })}</b><span>{euro(p.price)}</span>
                        </button>
                    ))}
                    <button type="button" className="ax-pack-x" onClick={() => setOpen(false)}>{t('Cancelar')}</button>
                </div>
            ) : (
                <button type="button" className="ui-btn ui-btn-accent" onClick={() => setOpen(true)}>{t('Comprar créditos')}</button>
            )}
            <p className="ax-hint">{t('1 crédito = 1 conversa com o Alex, até :m minutos.', { m: alex.minutes })}</p>
        </>
    );
}

/**
 * Vive fora das páginas (app.jsx): o som do Alex e a janela flutuante, quando a conversa não está
 * dentro do painel da aula. Assim a conversa continua quando o aluno muda de página.
 */
export default function AlexHost() {
    const s = useAlexCall();
    const audio = useRef(null);
    const { auth } = usePage().props;
    const [box, setBox] = useWindowBox();

    useEffect(() => {
        if (audio.current) audio.current.srcObject = s.alexAudio ? new MediaStream([s.alexAudio]) : null;
    }, [s.alexAudio]);

    // Ao sair da conta, a conversa termina
    useEffect(() => { if (!auth?.user && isActive(s)) endAlex(); }, [auth?.user]); // eslint-disable-line react-hooks/exhaustive-deps

    const floating = s.status !== 'idle' && s.docked === 0;
    return (
        <>
            <audio ref={audio} autoPlay />
            {floating && createPortal(
                <section className="ax-win" role="dialog" aria-label={t('Conversa com o Alex')}
                    style={{ '--ax-w': `${box.w}px`, '--ax-h': `${box.h}px`, '--ax-r': `${box.r}px`, '--ax-b': `${box.b}px` }}>
                    <ResizeCorner box={box} onChange={setBox} />
                    <MoveHeader box={box} onChange={setBox}>
                        <img src="/images/alex.png" alt="" />
                        <span><b>{t('Alex')}</b><small>{s.place ? t(PLACE[s.place]) : ''}</small></span>
                    </MoveHeader>
                    <AlexCallView onClose={dismissAlex} />
                </section>,
                document.body,
            )}
        </>
    );
}
