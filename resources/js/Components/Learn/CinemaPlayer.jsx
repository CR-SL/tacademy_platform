import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import '../../../css/player.css';

import { t } from '@/i18n';

// Leitor próprio da T.Academy, estilo YouTube (escolhido a 2026-11-24; exemplo em landing-concepts/leitor-youtube.html;
// antes era a cápsula "Cinema" de 2026-10-28). Barra a toda a largura no fundo com a linha do tempo por cima;
// roda dentada com Velocidade e Qualidade; duplo clique nos lados salta 10 s, ao centro ecrã inteiro.
// HLS (.m3u8, várias qualidades) com hls.js — carregado só quando é preciso; o iPhone toca HLS nativo; MP4 direto.
// A contagem do tempo visto fica no VideoPlayer: aqui só se mostram os troços vistos (amarelo), a meta e o selo "Visto".

const RATES = [0.75, 1, 1.25, 1.5, 1.75, 2];
const GOAL = 90;
const fmt = (s) => { s = Math.max(0, Math.floor(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const rateLabel = (r) => (r === 1 ? t('Normal') : `${String(r).replace('.', ',')}×`);

// Troços vistos a partir do mapa de bits (1 bit por segundo)
function segmentsOf(map, duration) {
    const seg = [];
    let start = -1;
    for (let s = 0; s <= duration; s++) {
        const on = s < duration && map[s >> 3] & (1 << (s & 7));
        if (on && start < 0) start = s;
        if (!on && start >= 0) { seg.push([start, s]); start = -1; }
    }
    return seg;
}
const isSeen = (map, s) => !!(map && map[s >> 3] & (1 << (s & 7)));

const Icon = ({ d }) => <svg viewBox="0 0 24 24" aria-hidden="true">{d}</svg>;
const PLAY = <path d="M8 5.1v13.8a1 1 0 0 0 1.5.86l11-6.9a1 1 0 0 0 0-1.72l-11-6.9A1 1 0 0 0 8 5.1z" />;
const PAUSE = <><rect x="6" y="4.5" width="4" height="15" rx="1" /><rect x="14" y="4.5" width="4" height="15" rx="1" /></>;
const TEN = <text x="12" y="16.3" fontSize="6.6" fontWeight="800" textAnchor="middle" fontFamily="inherit">10</text>;
const BACK = <><path d="M12 5V2L7 6l5 4V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z" />{TEN}</>;
const FWD = <><path d="M12 5V2l5 4-5 4V7a6 6 0 1 0 6 6h2a8 8 0 1 1-8-8z" />{TEN}</>;
const VOL = <path d="M3 9v6h4l5 4V5L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z" />;
const VOL_LOW = <path d="M3 9v6h4l5 4V5L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z" />;
const MUTE = <path d="M3 9v6h4l5 4V5L7 9H3zm13.6 3 2.7-2.7-1.4-1.4-2.7 2.7-2.7-2.7-1.4 1.4 2.7 2.7-2.7 2.7 1.4 1.4 2.7-2.7 2.7 2.7 1.4-1.4z" />;
const FULL = <path d="M4 9V4h5v2H6v3H4zm11-5h5v5h-2V6h-3V4zM6 15v3h3v2H4v-5h2zm12 0h2v5h-5v-2h3v-3z" />;
const EXIT = <path d="M7 4h2v5H4V7h3V4zm8 0h2v3h3v2h-5V4zM4 15h5v5H7v-3H4v-2zm11 0h5v2h-3v3h-2v-5z" />;
const GEAR = <path d="M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.4 7.4 0 0 0-1.7-1L15 3.3h-4l-.4 2.6a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.4 7.4 0 0 0 1.7 1l.4 2.6h4l.4-2.6a7.4 7.4 0 0 0 1.7-1l2.5 1 2-3.5L19.4 13zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" />;
const SPEED = <path d="M12 4a9 9 0 0 0-7.8 13.5l1.7-1A7 7 0 1 1 19 12h2a9 9 0 0 0-9-8zm4.6 4-5.2 3.4a1.5 1.5 0 1 0 2 2L16.6 8z" />;
const HD = <path d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm2.5 4v6H8v-2.3h2V15h1.5V9H10v2.2H8V9H6.5zm6.5 0v6h3a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-3zm1.5 1.5H16a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5h-1.5v-3z" />;

const VOLUME_KEY = 'ta-volume';
const readVolume = () => { try { const v = parseFloat(localStorage.getItem(VOLUME_KEY)); return Number.isFinite(v) && v >= 0.05 ? Math.min(1, v) : 1; } catch { return 1; } };
const fsElement = () => document.fullscreenElement ?? document.webkitFullscreenElement ?? null;

const CinemaPlayer = forwardRef(function CinemaPlayer({ src, startAt = 0, map, duration: knownDuration = 0, onReady, onPlay, onTime, onPause }, ref) {
    const root = useRef(null);
    const video = useRef(null);
    const track = useRef(null);
    const volLine = useRef(null);
    const hls = useRef(null);
    const idleT = useRef(null);
    const flashT = useRef(null);
    const clickT = useRef(null);
    const fxId = useRef(0);
    const dragging = useRef(false);
    const volDrag = useRef(false);
    const menuOpen = useRef(null);
    // Toque no ecrã com os comandos escondidos: só os mostra (não pausa nem carrega num botão invisível)
    const hiddenRef = useRef(false);
    const tapWhileHidden = useRef(false);

    const [playing, setPlaying] = useState(false);
    const [started, setStarted] = useState(false);
    const [tx, setT] = useState(startAt);
    const [dur, setDur] = useState(0);
    const [buf, setBuf] = useState(0);
    const [volume, setVolume] = useState(1);
    const [muted, setMuted] = useState(false);
    const [rate, setRate] = useState(1);
    const [levels, setLevels] = useState([]);
    const [failed, setFailed] = useState(false); // o vídeo não carregou (rede, ficheiro em falta)
    const [retry, setRetry] = useState(0);
    const resumeFrom = useRef(startAt); // segundo onde retomar (ao abrir ou ao tentar outra vez)
    const [level, setLevel] = useState(-1);
    const [autoH, setAutoH] = useState(null);
    const [menu, setMenu] = useState(null); // null | 'main' | 'speed' | 'quality'
    const [idle, setIdle] = useState(false);
    const [waiting, setWaiting] = useState(false);
    const [full, setFull] = useState(false);
    const [tip, setTip] = useState(null);
    const [drag, setDrag] = useState(false);
    const [volDragging, setVolDragging] = useState(false);
    const [flash, setFlash] = useState(null); // aviso rápido ao mudar o volume ou a velocidade pelo teclado
    const [fx, setFx] = useState([]); // ícone a pulsar ao clicar e "10 segundos" ao saltar

    useImperativeHandle(ref, () => ({
        pause: () => video.current?.pause(),
        seek: (s) => { if (video.current) video.current.currentTime = s; },
    }), []);

    useEffect(() => {
        const v = video.current;
        v.volume = readVolume(); // o volume escolhido fica guardado neste browser
        let cancelled = false;
        if (/\.m3u8(\?|$)/i.test(src)) {
            // hls.js sempre que possível (dá a escolha da qualidade); senão HLS nativo (iPhone)
            import('hls.js').then(({ default: Hls }) => {
                if (cancelled) return;
                if (!Hls.isSupported()) { v.src = src; return; }
                const h = new Hls({ capLevelToPlayerSize: true });
                hls.current = h;
                h.loadSource(src);
                h.attachMedia(v);
                h.on(Hls.Events.MANIFEST_PARSED, (e, d) => setLevels(
                    d.levels.map((l, i) => ({ i, h: l.height })).sort((a, b) => b.h - a.h).filter((x, k, a) => !k || a[k - 1].h !== x.h),
                ));
                h.on(Hls.Events.LEVEL_SWITCHED, (e, d) => setAutoH(h.levels[d.level]?.height ?? null));
                // Erros que o hls.js não resolve sozinho: mostra o aviso com "Tentar outra vez"
                h.on(Hls.Events.ERROR, (e, d) => { if (d.fatal) { setWaiting(false); setFailed(true); } });
            }).catch(() => { if (!cancelled) setFailed(true); });
        } else {
            v.src = src;
        }
        return () => { cancelled = true; hls.current?.destroy(); hls.current = null; };
    }, [src, retry]);

    const tryAgain = () => {
        resumeFrom.current = tx;
        setFailed(false);
        setRetry((n) => n + 1);
    };

    useEffect(() => {
        const onFs = () => setFull(fsElement() === root.current);
        document.addEventListener('fullscreenchange', onFs);
        document.addEventListener('webkitfullscreenchange', onFs);
        return () => {
            document.removeEventListener('fullscreenchange', onFs);
            document.removeEventListener('webkitfullscreenchange', onFs);
            clearTimeout(idleT.current);
            clearTimeout(flashT.current);
            clearTimeout(clickT.current);
        };
    }, []);

    // O menu da roda dentada fecha ao clicar fora
    useEffect(() => {
        menuOpen.current = menu;
        if (!menu) return;
        const close = (e) => { if (!e.target.closest?.('[data-menu]')) setMenu(null); };
        document.addEventListener('pointerdown', close);
        return () => document.removeEventListener('pointerdown', close);
    }, [menu]);

    // Os comandos escondem-se ao fim de 2,5 s a ver sem mexer no rato
    const wake = () => {
        setIdle(false);
        clearTimeout(idleT.current);
        idleT.current = setTimeout(() => {
            if (video.current && !video.current.paused && !menuOpen.current && !dragging.current && !volDrag.current) setIdle(true);
        }, 2500);
    };
    const showFlash = (text) => {
        setFlash(text);
        clearTimeout(flashT.current);
        flashT.current = setTimeout(() => setFlash(null), 800);
    };
    const effect = (kind) => {
        const id = ++fxId.current;
        setFx((list) => [...list, { id, kind }]);
        setTimeout(() => setFx((list) => list.filter((f) => f.id !== id)), 750);
    };

    const toggle = () => { const v = video.current; v.paused ? v.play().catch(() => {}) : v.pause(); };
    const skip = (s) => { const v = video.current; if (v.duration) v.currentTime = Math.min(v.duration, Math.max(0, v.currentTime + s)); };
    const toggleMute = () => { const v = video.current; v.muted = !v.muted; if (!v.muted && v.volume === 0) v.volume = 0.5; };
    const setVol = (x) => { const v = video.current; v.volume = Math.min(1, Math.max(0, Math.round(x * 100) / 100)); v.muted = v.volume === 0; };
    const volFrom = (e) => { const r = volLine.current.getBoundingClientRect(); setVol((e.clientX - r.left) / r.width); };
    const toggleFull = () => {
        const el = root.current;
        if (fsElement()) (document.exitFullscreen ?? document.webkitExitFullscreen)?.call(document);
        else if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen(); // Safari no Mac
        else video.current.webkitEnterFullscreen?.(); // iPhone
    };
    const setSpeed = (r) => { video.current.playbackRate = r; setMenu('main'); };
    const pickLevel = (i) => { if (hls.current) hls.current.currentLevel = i; setLevel(i); setMenu('main'); };

    // Clique no vídeo: pausa ou reproduz (com o ícone a pulsar); duplo clique nos lados salta 10 s, ao centro ecrã inteiro
    const onVideoClick = (e) => {
        if (tapWhileHidden.current) return;
        const r = root.current.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        if (clickT.current) {
            clearTimeout(clickT.current);
            clickT.current = null;
            if (x < 0.34) { skip(-10); effect('back'); } else if (x > 0.66) { skip(10); effect('fwd'); } else toggleFull();
            return;
        }
        clickT.current = setTimeout(() => {
            clickT.current = null;
            const v = video.current;
            effect(v.paused ? 'play' : 'pause');
            toggle();
        }, 220);
    };

    // Linha do tempo: clicar ou arrastar; a dica mostra o tempo e se esse troço já foi visto
    const posOf = (e) => { const r = track.current.getBoundingClientRect(); return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)); };
    const seekTo = (e) => { const v = video.current; if (v.duration) v.currentTime = posOf(e) * v.duration; };

    const onKey = (e) => {
        if (e.target.matches?.('input')) return;
        const k = e.key.toLowerCase();
        const v = video.current;
        // Esc fecha o menu
        if (k === 'escape' && menu) { setMenu(null); root.current.focus(); e.preventDefault(); return; }
        // Com o foco num botão do leitor, Espaço e Enter carregam nesse botão (não pausam o vídeo)
        if ((k === ' ' || k === 'enter') && e.target.closest?.('button')) return;
        // Com o foco no volume, as setas ← → mudam o volume
        if (e.target === volLine.current?.parentElement && (k === 'arrowleft' || k === 'arrowright')) {
            setVol((v.muted ? 0 : v.volume) + (k === 'arrowright' ? 0.1 : -0.1));
            e.preventDefault();
            return;
        }
        if (k === ' ' || k === 'k') { effect(v.paused ? 'play' : 'pause'); toggle(); }
        else if (k === 'arrowleft' || k === 'j') { skip(-10); effect('back'); }
        else if (k === 'arrowright' || k === 'l') { skip(10); effect('fwd'); }
        else if (k === 'arrowup' || k === 'arrowdown') {
            setVol((v.muted ? 0 : v.volume) + (k === 'arrowup' ? 0.1 : -0.1));
            showFlash(t('Volume :v1%', { v1: Math.round(v.volume * 100) }));
        } else if (k === '>' || k === '<') {
            const i = RATES.indexOf(v.playbackRate);
            v.playbackRate = RATES[Math.min(RATES.length - 1, Math.max(0, (i < 0 ? 1 : i) + (k === '>' ? 1 : -1)))];
            showFlash(t('Velocidade :v1', { v1: rateLabel(v.playbackRate) }));
        } else if (k === 'f') toggleFull();
        else if (k === 'm') toggleMute();
        else return;
        e.preventDefault();
        wake();
    };

    const d = dur || knownDuration;
    const pct = (s) => `${d ? Math.min(100, (s / d) * 100) : 0}%`;
    const whole = Math.floor(d);
    const seen = whole && map ? segmentsOf(map, whole) : [];
    const seenPct = whole ? Math.min(100, Math.round((seen.reduce((a, [x, y]) => a + y - x, 0) / whole) * 100)) : 0;
    const hidden = idle && playing;
    hiddenRef.current = hidden;
    const shownVolume = muted ? 0 : volume;
    const qualityLabel = level === -1 ? (autoH ? t('Auto (:h)', { h: `${autoH}p` }) : t('Auto')) : `${levels.find((l) => l.i === level)?.h}p`;

    return (
        <div ref={root} tabIndex={0} onKeyDown={onKey} onFocus={wake}
            onPointerMove={(e) => { if (e.pointerType === 'mouse') wake(); }}
            onPointerDownCapture={(e) => { tapWhileHidden.current = hiddenRef.current && e.pointerType !== 'mouse'; wake(); }}
            aria-label={t('Leitor de vídeo (espaço: reproduzir ou pausar, setas ← →: 10 segundos, ↑ ↓: volume, F: ecrã inteiro, M: som)')}
            className={`yp ${hidden ? 'yp-idle' : ''}`}>
            <video ref={video} playsInline preload="metadata" onClick={onVideoClick}
                onLoadedMetadata={(e) => {
                    const v = e.currentTarget;
                    const from = resumeFrom.current;
                    if (from > 2 && v.currentTime < 1) v.currentTime = from - 2; // retoma onde parou
                    setDur(v.duration);
                    onReady?.(v.duration);
                }}
                onTimeUpdate={(e) => { const ct = e.currentTarget.currentTime; setT(ct); onTime?.(ct); }}
                onPlay={(e) => { setPlaying(true); setStarted(true); onPlay?.(e.currentTarget.currentTime); wake(); }}
                onPause={() => { setPlaying(false); setIdle(false); onPause?.(); }}
                onEnded={() => onPause?.()}
                onWaiting={() => setWaiting(true)}
                onPlaying={() => setWaiting(false)}
                onProgress={(e) => { const b = e.currentTarget.buffered; setBuf(b.length ? b.end(b.length - 1) : 0); }}
                onVolumeChange={(e) => {
                    const v = e.currentTarget;
                    setMuted(v.muted || v.volume === 0);
                    setVolume(v.volume);
                    // Guarda o volume escolhido (sem som não se guarda: a aula seguinte começa sempre com som)
                    if (v.volume > 0) { try { localStorage.setItem(VOLUME_KEY, String(v.volume)); } catch { /* sem armazenamento: não guarda */ } }
                }}
                onRateChange={(e) => setRate(e.currentTarget.playbackRate)}
                onError={() => { if (!hls.current) { setWaiting(false); setFailed(true); } }}
            />

            <div className="yp-shade" aria-hidden="true" />

            {failed && (
                <div role="alert" className="yp-fail">
                    <p className="max-w-sm text-[15px]">{t('Não foi possível carregar o vídeo. Verifica a ligação à internet e tenta outra vez.')}</p>
                    <button type="button" className="ui-btn ui-btn-sm ui-btn-glass" onClick={tryAgain}>{t('Tentar outra vez')}</button>
                </div>
            )}

            {waiting && <span className="yp-spin" aria-hidden="true" />}
            {flash && <span className="yp-flash" role="status">{flash}</span>}
            {fx.map((f) => (f.kind === 'back' || f.kind === 'fwd' ? (
                <div key={f.id} className={`yp-skip ${f.kind === 'back' ? 'yp-l' : 'yp-r'}`} aria-hidden="true">
                    <span>{f.kind === 'back' ? '◀◀' : '▶▶'}</span>{t('10 segundos')}
                </div>
            ) : (
                <div key={f.id} className="yp-pulse" aria-hidden="true"><Icon d={f.kind === 'play' ? PLAY : PAUSE} /></div>
            )))}

            {!started && !failed && (
                <button type="button" onClick={toggle} aria-label={t('Reproduzir')} className="yp-big"><Icon d={PLAY} /></button>
            )}

            {menu && (
                <div data-menu className="yp-menu" style={{ maxHeight: Math.max(120, (root.current?.clientHeight ?? 300) - 90) }}>
                    {menu === 'main' && (
                        <>
                            <button type="button" onClick={() => setMenu('speed')}><Icon d={SPEED} />{t('Velocidade')}<span className="yp-v">{rateLabel(rate)}</span></button>
                            {levels.length > 0 && (
                                <button type="button" onClick={() => setMenu('quality')}><Icon d={HD} />{t('Qualidade')}<span className="yp-v">{qualityLabel}</span></button>
                            )}
                        </>
                    )}
                    {menu === 'speed' && (
                        <>
                            <button type="button" className="yp-head-b" onClick={() => setMenu('main')}>{t('Velocidade')}</button>
                            {RATES.map((r) => (
                                <button key={r} type="button" onClick={() => setSpeed(r)} aria-pressed={rate === r}>
                                    <span className="yp-ck">{rate === r ? '✓' : ''}</span>{rateLabel(r)}
                                </button>
                            ))}
                        </>
                    )}
                    {menu === 'quality' && (
                        <>
                            <button type="button" className="yp-head-b" onClick={() => setMenu('main')}>{t('Qualidade')}</button>
                            {[{ i: -1, h: null }, ...levels].map((l) => (
                                <button key={l.i} type="button" onClick={() => pickLevel(l.i)} aria-pressed={level === l.i}>
                                    <span className="yp-ck">{level === l.i ? '✓' : ''}</span>
                                    {l.h ? `${l.h}p` : t('Auto')}
                                    {!l.h && autoH && <small>{autoH}p</small>}
                                    {l.h >= 720 && <small>{t('HD')}</small>}
                                </button>
                            ))}
                        </>
                    )}
                </div>
            )}

            {/* Comandos no fundo. Escondidos, continuam a responder ao rato; um toque com eles escondidos só os mostra. */}
            <div className="yp-ui" onClickCapture={(e) => { if (tapWhileHidden.current) { e.stopPropagation(); e.preventDefault(); } }}>
                {/* Linha do tempo: troços já vistos (amarelo), meta dos 90% e posição */}
                <div className={`yp-tl ${drag ? 'yp-drag' : ''}`} role="slider" tabIndex={-1} aria-label={t('Posição no vídeo')}
                    aria-valuemin={0} aria-valuemax={whole} aria-valuenow={Math.floor(tx)} aria-valuetext={t(':at de :of', { at: fmt(tx), of: fmt(d) })}
                    onPointerDown={(e) => { if (!d || tapWhileHidden.current) return; e.currentTarget.setPointerCapture(e.pointerId); dragging.current = true; setDrag(true); seekTo(e); }}
                    onPointerMove={(e) => { const p = posOf(e); setTip({ p, t: p * d }); if (dragging.current) seekTo(e); }}
                    onPointerUp={() => { dragging.current = false; setDrag(false); }}
                    onPointerLeave={() => setTip(null)}>
                    <div ref={track} className="yp-track">
                        <span className="yp-buf" style={{ width: pct(buf) }} />
                        {tip && <span className="yp-hov" style={{ width: `${tip.p * 100}%` }} />}
                        {seen.map(([a, b]) => <i key={a} className="yp-seen" style={{ left: pct(a), width: pct(b - a) }} />)}
                        <span className="yp-goal" title={t('Meta: 90%')} aria-hidden="true" />
                        <span className="yp-head" style={{ left: pct(tx) }} aria-hidden="true" />
                    </div>
                    {tip && d > 0 && (
                        <span className="yp-tip" style={{ left: `${Math.min(96, Math.max(4, tip.p * 100))}%` }}>
                            {fmt(tip.t)}
                            {isSeen(map, Math.floor(tip.t)) && <small>{t('Já viste')}</small>}
                        </span>
                    )}
                </div>

                <div className="yp-row">
                    <button type="button" className="yp-b" onClick={toggle} aria-label={playing ? t('Pausar') : t('Reproduzir')} title={playing ? t('Pausar (espaço)') : t('Reproduzir (espaço)')}>
                        <Icon d={playing ? PAUSE : PLAY} />
                    </button>
                    <button type="button" className="yp-b yp-sm" onClick={() => skip(-10)} aria-label={t('Recuar 10 segundos')} title={t('Recuar 10 segundos (←)')}><Icon d={BACK} /></button>
                    <button type="button" className="yp-b yp-sm" onClick={() => skip(10)} aria-label={t('Avançar 10 segundos')} title={t('Avançar 10 segundos (→)')}><Icon d={FWD} /></button>
                    {/* Som: o botão liga e desliga; a barra do volume abre ao lado ao passar o rato. No telemóvel usa-se o volume do aparelho. */}
                    <div className={`yp-vol ${volDragging ? 'yp-drag' : ''}`}>
                        <button type="button" className="yp-b" onClick={toggleMute} aria-label={muted ? t('Ligar o som') : t('Tirar o som')} title={muted ? t('Ligar o som (M)') : t('Tirar o som (M)')}>
                            <Icon d={shownVolume === 0 ? MUTE : shownVolume < 0.5 ? VOL_LOW : VOL} />
                        </button>
                        <div className="yp-slide" role="slider" tabIndex={0} aria-label={t('Volume')}
                            aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(shownVolume * 100)}
                            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); volDrag.current = true; setVolDragging(true); volFrom(e); }}
                            onPointerMove={(e) => { if (volDrag.current) volFrom(e); }}
                            onPointerUp={() => { volDrag.current = false; setVolDragging(false); }}>
                            <i ref={volLine}><b style={{ width: `${shownVolume * 100}%` }} /><em style={{ left: `${shownVolume * 100}%` }} /></i>
                        </div>
                    </div>
                    <span className="yp-time">{fmt(tx)} <span>/ {fmt(d)}</span></span>

                    {map ? (
                        <span className={`yp-chip ${seenPct >= GOAL ? 'yp-done' : ''}`} title={t('Para concluir a aula basta ver 90% do vídeo')}>
                            <i aria-hidden="true" />
                            <span className="yp-long">{t('Visto')} </span>{seenPct}%<span className="yp-long"> · {t('meta 90%')}</span>
                        </span>
                    ) : <span className="yp-spacer" />}
                    <button type="button" className="yp-b" data-menu onClick={() => setMenu((m) => (m ? null : 'main'))} aria-label={t('Definições')} aria-expanded={!!menu} title={t('Definições')}>
                        <Icon d={GEAR} />
                    </button>
                    <button type="button" className="yp-b" onClick={toggleFull} aria-label={full ? t('Sair do ecrã inteiro') : t('Ecrã inteiro')} title={full ? t('Sair do ecrã inteiro (F)') : t('Ecrã inteiro (F)')}>
                        <Icon d={full ? EXIT : FULL} />
                    </button>
                </div>
            </div>
        </div>
    );
});

export default CinemaPlayer;
