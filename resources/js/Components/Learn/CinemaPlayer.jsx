import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

// Leitor próprio da T.Academy (opção C "Cinema", escolhida a 2026-10-28; exemplo em landing-concepts/leitor-video-opcoes.html).
// Vídeo de ponta a ponta, comandos numa cápsula flutuante e barra fina no fundo, que se escondem quando não estão em uso.
// HLS (.m3u8, várias qualidades) com hls.js — carregado só quando é preciso; o iPhone toca HLS nativo; MP4 direto.
// A contagem do tempo visto fica no VideoPlayer: aqui só se mostram os troços vistos (amarelo) e a meta.

const RATES = [0.75, 1, 1.25, 1.5, 1.75, 2];
const fmt = (s) => { s = Math.max(0, Math.floor(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const rateLabel = (r) => `${String(r).replace('.', ',')}×`;

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

const Icon = ({ d, className = 'h-[18px] w-[18px]' }) => <svg viewBox="0 0 24 24" className={`${className} fill-current`} aria-hidden="true">{d}</svg>;
const PLAY = <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z" />;
const PAUSE = <><rect x="5.5" y="4" width="4.5" height="16" rx="1" /><rect x="14" y="4" width="4.5" height="16" rx="1" /></>;
const TEN = <text x="12" y="16.5" fontSize="7" fontWeight="700" textAnchor="middle" fontFamily="Geist Mono, monospace">10</text>;
const BACK = <><path d="M12 5V2L7 6l5 4V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z" />{TEN}</>;
const FWD = <><path d="M12 5V2l5 4-5 4V7a6 6 0 1 0 6 6h2a8 8 0 1 1-8-8z" />{TEN}</>;
const VOL = <path d="M3 9v6h4l5 4V5L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z" />;
const VOL_LOW = <path d="M3 9v6h4l5 4V5L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z" />;
const MUTE = <path d="M3 9v6h4l5 4V5L7 9H3zm13.6 3 2.7-2.7-1.4-1.4-2.7 2.7-2.7-2.7-1.4 1.4 2.7 2.7-2.7 2.7 1.4 1.4 2.7-2.7 2.7 2.7 1.4-1.4z" />;
const FULL = <path d="M4 9V4h5v2H6v3H4zm11-5h5v5h-2V6h-3V4zM6 15v3h3v2H4v-5h2zm12 0h2v5h-5v-2h3v-3z" />;
const EXIT = <path d="M7 4h2v5H4V7h3V4zm8 0h2v3h3v2h-5V4zM4 15h5v5H7v-3H4v-2zm11 0h5v2h-3v3h-2v-5z" />;
const GEAR = <path d="M18.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.4 7.4 0 0 0-1.7-1L14 3.3h-4l-.4 2.6a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.5L5.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.4 7.4 0 0 0 1.7 1l.4 2.6h4l.4-2.6a7.4 7.4 0 0 0 1.7-1l2.5 1 2-3.5L18.4 13zM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" />;

const BTN = 'grid h-8 w-8 place-items-center transition-colors hover:text-accent';

const VOLUME_KEY = 'ta-volume';
const readVolume = () => { try { const v = parseFloat(localStorage.getItem(VOLUME_KEY)); return Number.isFinite(v) && v >= 0.05 ? Math.min(1, v) : 1; } catch { return 1; } };
const fsElement = () => document.fullscreenElement ?? document.webkitFullscreenElement ?? null;

const CinemaPlayer = forwardRef(function CinemaPlayer({ src, startAt = 0, map, duration: knownDuration = 0, onReady, onPlay, onTime, onPause }, ref) {
    const root = useRef(null);
    const video = useRef(null);
    const tl = useRef(null);
    const hls = useRef(null);
    const idleT = useRef(null);
    const flashT = useRef(null);
    const dragging = useRef(false);
    const menuOpen = useRef(null);
    const volBtn = useRef(null);
    const volTrack = useRef(null);
    const volDrag = useRef(false);
    const volT = useRef(null);
    const volOpen = useRef(false);
    const volPop = useRef(null);
    // Toque no ecrã com os comandos escondidos: só os mostra (não pausa nem carrega num botão invisível)
    const hiddenRef = useRef(false);
    const tapWhileHidden = useRef(false);

    const [playing, setPlaying] = useState(false);
    const [started, setStarted] = useState(false);
    const [t, setT] = useState(startAt);
    const [dur, setDur] = useState(0);
    const [buf, setBuf] = useState(0);
    const [volume, setVolume] = useState(1);
    const [muted, setMuted] = useState(false);
    const [rate, setRate] = useState(1);
    const [levels, setLevels] = useState([]);
    const [level, setLevel] = useState(-1);
    const [autoH, setAutoH] = useState(null);
    const [menu, setMenu] = useState(null); // 'speed' | 'quality'
    const [idle, setIdle] = useState(false);
    const [waiting, setWaiting] = useState(false);
    const [full, setFull] = useState(false);
    const [tip, setTip] = useState(null);
    const [flash, setFlash] = useState(null); // aviso rápido ao mudar o volume ou a velocidade pelo teclado
    const [volX, setVolX] = useState(null); // posição (px) da barra vertical do volume, por cima do botão do som; null = fechada

    useImperativeHandle(ref, () => ({ pause: () => video.current?.pause() }), []);

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
            });
        } else {
            v.src = src;
        }
        return () => { cancelled = true; hls.current?.destroy(); hls.current = null; };
    }, [src]);

    useEffect(() => {
        const onFs = () => setFull(fsElement() === root.current);
        document.addEventListener('fullscreenchange', onFs);
        document.addEventListener('webkitfullscreenchange', onFs);
        return () => {
            document.removeEventListener('fullscreenchange', onFs);
            document.removeEventListener('webkitfullscreenchange', onFs);
            clearTimeout(idleT.current);
            clearTimeout(flashT.current);
            clearTimeout(volT.current);
        };
    }, []);

    // Os menus (velocidade e qualidade) fecham ao clicar fora
    useEffect(() => {
        menuOpen.current = menu;
        if (!menu) return;
        const close = (e) => { if (!e.target.closest?.('[data-controls]')) setMenu(null); };
        document.addEventListener('pointerdown', close);
        return () => document.removeEventListener('pointerdown', close);
    }, [menu]);

    // Os comandos escondem-se ao fim de 2,5 s a ver sem mexer no rato
    const wake = () => {
        setIdle(false);
        clearTimeout(idleT.current);
        idleT.current = setTimeout(() => {
            if (video.current && !video.current.paused && !menuOpen.current && !dragging.current && !volDrag.current && !volOpen.current) setIdle(true);
        }, 2500);
    };
    const showFlash = (text) => {
        setFlash(text);
        clearTimeout(flashT.current);
        flashT.current = setTimeout(() => setFlash(null), 800);
    };

    const toggle = () => { const v = video.current; v.paused ? v.play().catch(() => {}) : v.pause(); };
    const skip = (s) => { const v = video.current; if (v.duration) v.currentTime = Math.min(v.duration, Math.max(0, v.currentTime + s)); };
    const toggleMute = () => { const v = video.current; v.muted = !v.muted; if (!v.muted && v.volume === 0) v.volume = 0.5; };
    const setVol = (x) => { const v = video.current; v.volume = Math.min(1, Math.max(0, Math.round(x * 100) / 100)); v.muted = v.volume === 0; };
    // Barra vertical do volume: abre ao passar o rato no botão do som e fecha pouco depois de o rato sair
    // (o atraso deixa passar do botão para a barra)
    const openVol = () => {
        clearTimeout(volT.current);
        const b = volBtn.current;
        volOpen.current = true;
        setVolX(b.offsetLeft + b.offsetWidth / 2);
    };
    const closeVolSoon = () => {
        clearTimeout(volT.current);
        volT.current = setTimeout(() => { if (!volDrag.current) { volOpen.current = false; setVolX(null); } }, 300);
    };
    const volFrom = (e) => { const r = volTrack.current.getBoundingClientRect(); setVol(1 - (e.clientY - r.top) / r.height); };
    const setSpeed = (r) => { video.current.playbackRate = r; setMenu(null); };
    const toggleFull = () => {
        const el = root.current;
        if (fsElement()) (document.exitFullscreen ?? document.webkitExitFullscreen)?.call(document);
        else if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen(); // Safari no Mac
        else video.current.webkitEnterFullscreen?.(); // iPhone
    };
    const pickLevel = (i) => { if (hls.current) hls.current.currentLevel = i; setLevel(i); setMenu(null); };

    // Linha do tempo: clicar ou arrastar; a dica mostra o tempo
    const posOf = (e) => { const r = tl.current.getBoundingClientRect(); return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)); };
    const seekTo = (e) => { const v = video.current; if (v.duration) v.currentTime = posOf(e) * v.duration; };

    const onKey = (e) => {
        if (e.target.matches?.('input')) return;
        const k = e.key.toLowerCase();
        const v = video.current;
        if (k === ' ' || k === 'k') toggle();
        else if (k === 'arrowleft' || k === 'j') skip(-10);
        else if (k === 'arrowright' || k === 'l') skip(10);
        else if (k === 'arrowup' || k === 'arrowdown') {
            setVol((v.muted ? 0 : v.volume) + (k === 'arrowup' ? 0.1 : -0.1));
            showFlash(`Volume ${Math.round(v.volume * 100)}%`);
        } else if (k === '>' || k === '<') {
            const i = RATES.indexOf(v.playbackRate);
            v.playbackRate = RATES[Math.min(RATES.length - 1, Math.max(0, (i < 0 ? 1 : i) + (k === '>' ? 1 : -1)))];
            showFlash(`Velocidade ${rateLabel(v.playbackRate)}`);
        } else if (k === 'f') toggleFull();
        else if (k === 'm') toggleMute();
        else return;
        e.preventDefault();
        wake();
    };

    const d = dur || knownDuration;
    const pct = (s) => `${d ? Math.min(100, (s / d) * 100) : 0}%`;
    const seen = d && map ? segmentsOf(map, Math.floor(d)) : [];
    const hidden = idle && playing;
    hiddenRef.current = hidden;
    const shownVolume = muted ? 0 : volume;
    const menuItem = (on) => `flex items-center gap-1.5 px-2 py-2 text-left font-display text-[13px] font-semibold hover:bg-white/10 ${on ? 'text-accent' : ''}`;

    return (
        <div ref={root} tabIndex={0} onKeyDown={onKey} onFocus={wake}
            onPointerMove={(e) => { if (e.pointerType === 'mouse') wake(); }}
            onPointerDownCapture={(e) => { tapWhileHidden.current = hiddenRef.current && e.pointerType !== 'mouse'; wake(); }}
            aria-label="Leitor de vídeo (espaço: reproduzir ou pausar, setas ← →: 10 segundos, ↑ ↓: volume, F: ecrã inteiro, M: som)"
            className={`relative aspect-video w-full select-none overflow-hidden bg-black text-white outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${hidden ? 'cursor-none' : ''}`}>
            <video ref={video} playsInline preload="metadata" onDoubleClick={toggleFull}
                onClick={() => { if (!tapWhileHidden.current) toggle(); }}
                className="absolute inset-0 h-full w-full bg-black object-contain"
                onLoadedMetadata={(e) => {
                    const v = e.currentTarget;
                    if (startAt > 2 && v.currentTime < 1) v.currentTime = startAt - 2; // retoma onde parou
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
            />

            {waiting && <span className="pointer-events-none absolute left-1/2 top-1/2 -ml-[22px] -mt-[22px] h-11 w-11 animate-spin rounded-full border-[3px] border-white/25 border-t-accent" aria-hidden="true" />}
            {flash && (
                <span className="ta-cut-8 pointer-events-none absolute left-1/2 top-6 z-[4] -translate-x-1/2 bg-[rgba(24,24,27,.85)] px-3 py-1.5 font-display text-sm font-semibold" role="status">{flash}</span>
            )}

            {!started && (
                <button type="button" onClick={toggle} aria-label="Reproduzir"
                    className="absolute left-1/2 top-1/2 z-[2] grid h-[84px] w-[84px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[rgba(24,24,27,.6)] text-accent shadow-[0_0_0_2px_var(--color-accent)] backdrop-blur-sm transition-transform hover:scale-105">
                    <Icon d={PLAY} className="ml-1 h-8 w-8" />
                </button>
            )}

            {/* Cápsula de comandos (os menus ficam fora do recorte dos cantos). Escondida, continua a responder ao rato;
                um toque com ela escondida só a mostra. */}
            <div data-controls onClickCapture={(e) => { if (tapWhileHidden.current) { e.stopPropagation(); e.preventDefault(); } }}
                className={`absolute bottom-6 left-1/2 z-[3] -translate-x-1/2 transition-[opacity,transform] duration-300 max-sm:bottom-[18px] ${hidden ? 'translate-y-1.5 opacity-0' : ''}`}>
                {volX !== null && (
                    // Barra vertical do volume: arrastar ou clicar; a parte amarela é o volume atual
                    <div ref={volPop} className="absolute bottom-full -translate-x-1/2 pb-3" style={{ left: volX }}
                        onPointerEnter={openVol} onPointerLeave={closeVolSoon}>
                        <div className="flex flex-col items-center pt-1">
                            <div ref={volTrack} role="slider" tabIndex={-1} aria-label="Volume" aria-orientation="vertical"
                                aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(shownVolume * 100)}
                                className="relative h-24 w-6 cursor-pointer touch-none"
                                onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); volDrag.current = true; volFrom(e); }}
                                onPointerMove={(e) => { if (volDrag.current) volFrom(e); }}
                                onPointerUp={(e) => {
                                    volDrag.current = false;
                                    if (!volPop.current?.contains(document.elementFromPoint(e.clientX, e.clientY))) closeVolSoon(); // largou fora da barra
                                }}>
                                {/* Só a barra, sem fundo; a sombra leve mantém-na visível sobre imagens claras */}
                                <span className="absolute inset-y-0 left-1/2 w-1.5 -translate-x-1/2 rounded-full bg-white/40 shadow-[0_0_6px_rgba(0,0,0,.45)]" />
                                <span className="absolute bottom-0 left-1/2 w-1.5 -translate-x-1/2 rounded-full bg-accent" style={{ height: `${shownVolume * 100}%` }} />
                                <span className="absolute left-1/2 h-3.5 w-3.5 -translate-x-1/2 translate-y-1/2 rounded-full bg-accent shadow-[0_0_0_3px_rgba(248,177,1,.3)]" style={{ bottom: `${shownVolume * 100}%` }} />
                            </div>
                        </div>
                    </div>
                )}
                {menu && (
                    <div className="ta-cut-12 absolute bottom-full right-0 mb-2 flex w-44 flex-col overflow-auto bg-[rgba(24,24,27,.95)] p-2" style={{ maxHeight: Math.max(120, (root.current?.clientHeight ?? 300) - 90) }}>
                        <span className="px-2 pb-1.5 pt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-white/60">{menu === 'speed' ? 'Velocidade' : 'Qualidade'}</span>
                        {menu === 'speed' ? RATES.map((r) => (
                            <button key={r} type="button" onClick={() => setSpeed(r)} aria-pressed={rate === r} className={menuItem(rate === r)}>
                                {r === 1 ? 'Normal' : rateLabel(r)}
                            </button>
                        )) : [{ i: -1, h: null }, ...levels].map((l) => (
                            <button key={l.i} type="button" onClick={() => pickLevel(l.i)} aria-pressed={level === l.i} className={menuItem(level === l.i)}>
                                {l.h ? `${l.h}p` : 'Auto'}
                                {!l.h && level === -1 && autoH && <small className="font-normal text-white/60">· {autoH}p</small>}
                                {l.h >= 720 && <em className="border border-current px-1 font-mono text-[9px] not-italic opacity-70">HD</em>}
                            </button>
                        ))}
                    </div>
                )}
                <div className="ta-cut-8 flex items-center gap-0.5 whitespace-nowrap bg-[rgba(24,24,27,.74)] p-1 backdrop-blur-md">
                    <button type="button" onClick={() => skip(-10)} aria-label="Recuar 10 segundos" className={`${BTN} max-sm:hidden`}><Icon d={BACK} /></button>
                    <button type="button" onClick={toggle} aria-label={playing ? 'Pausar' : 'Reproduzir'}
                        className="ta-cut-8 mx-0.5 grid h-8 w-9 place-items-center bg-accent text-on-accent">
                        <Icon d={playing ? PAUSE : PLAY} />
                    </button>
                    <button type="button" onClick={() => skip(10)} aria-label="Avançar 10 segundos" className={`${BTN} max-sm:hidden`}><Icon d={FWD} /></button>
                    <span className="px-2 font-mono text-xs text-white/85">{fmt(t)} / {fmt(d)}</span>
                    {/* Som: o botão liga e desliga; ao passar o rato abre a barra vertical do volume por cima (fora da cápsula,
                        para não a alargar nem mudar os botões de sítio). No telemóvel usa-se o volume do aparelho. */}
                    <button ref={volBtn} type="button" onClick={toggleMute} aria-label={muted ? 'Ligar o som' : 'Tirar o som'}
                        onPointerEnter={(e) => { if (e.pointerType === 'mouse') openVol(); }} onPointerLeave={closeVolSoon} onFocus={openVol} onBlur={closeVolSoon}
                        className={`${BTN} max-sm:hidden`}>
                        <Icon d={shownVolume === 0 ? MUTE : shownVolume < 0.5 ? VOL_LOW : VOL} />
                    </button>
                    <button type="button" onClick={() => setMenu((m) => (m === 'speed' ? null : 'speed'))} aria-label={`Velocidade: ${rateLabel(rate)}`} aria-expanded={menu === 'speed'}
                        className={`h-8 min-w-[40px] px-1.5 font-display text-[12px] font-semibold transition-colors hover:text-accent ${rate !== 1 ? 'text-accent' : ''}`}>
                        {rateLabel(rate)}
                    </button>
                    {levels.length > 0 && (
                        <button type="button" onClick={() => setMenu((m) => (m === 'quality' ? null : 'quality'))} aria-label="Qualidade" aria-expanded={menu === 'quality'} className={BTN}><Icon d={GEAR} /></button>
                    )}
                    <button type="button" onClick={toggleFull} aria-label={full ? 'Sair do ecrã inteiro' : 'Ecrã inteiro'} className={BTN}><Icon d={full ? EXIT : FULL} /></button>
                </div>
            </div>

            {/* Barra fina do tempo: troços já vistos (amarelo), meta dos 90% e posição */}
            <div className={`group/tl absolute inset-x-0 bottom-0 z-[3] pt-4 transition-opacity duration-300 ${hidden ? 'opacity-0' : ''}`}>
                <div ref={tl} role="slider" aria-label="Posição no vídeo" aria-valuemin={0} aria-valuemax={Math.floor(d)} aria-valuenow={Math.floor(t)} aria-valuetext={`${fmt(t)} de ${fmt(d)}`}
                    className="relative h-1 cursor-pointer touch-none bg-white/25 transition-[height] duration-150 group-hover/tl:h-2.5"
                    onPointerDown={(e) => { if (!d || tapWhileHidden.current) return; e.currentTarget.setPointerCapture(e.pointerId); dragging.current = true; seekTo(e); }}
                    onPointerMove={(e) => { const p = posOf(e); setTip({ p, t: p * d }); if (dragging.current) seekTo(e); }}
                    onPointerUp={() => { dragging.current = false; }}
                    onPointerLeave={() => setTip(null)}>
                    <span className="absolute inset-y-0 left-0 bg-white/20" style={{ width: pct(buf) }} />
                    {seen.map(([a, b]) => <i key={a} className="absolute inset-y-0 bg-accent" style={{ left: pct(a), width: pct(b - a) }} />)}
                    <span className="absolute inset-y-0 left-[90%] z-[1] w-0.5 bg-white/70" title="Meta: 90%" aria-hidden="true" />
                    <span className="absolute top-1/2 z-[2] -ml-[7px] -mt-[7px] h-3.5 w-3.5 scale-0 rounded-full bg-accent transition-transform duration-150 group-hover/tl:scale-100" style={{ left: pct(t) }} aria-hidden="true" />
                    {tip && d > 0 && (
                        <span className="pointer-events-none absolute bottom-[calc(100%+12px)] -translate-x-1/2 whitespace-nowrap bg-[#18181B] px-2 py-1 font-mono text-[11px] text-white"
                            style={{ left: `${Math.min(94, Math.max(6, tip.p * 100))}%` }}>
                            {fmt(tip.t)}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
});

export default CinemaPlayer;
