import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

// Leitor da aula de vídeo. Conta os segundos REALMENTE reproduzidos num mapa de bits (1 bit por segundo):
// saltar à frente não conta e rever não conta duas vezes. Grava a posição para retomar e envia o progresso.
// YouTube e Vimeo usam a API do leitor; outros links abrem num separador e conta o tempo com a página visível.

const loaded = {};
function loadScript(src, ready) {
    if (ready()) return Promise.resolve();
    loaded[src] ??= new Promise((resolve) => {
        if (src.includes('youtube')) {
            const prev = window.onYouTubeIframeAPIReady;
            window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(); };
        }
        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        if (!src.includes('youtube')) s.onload = () => resolve();
        document.head.appendChild(s);
    });
    return loaded[src];
}

const fromBase64 = (b64) => {
    try { return Uint8Array.from(atob(b64 || ''), (c) => c.charCodeAt(0)); } catch { return new Uint8Array(0); }
};
const toBase64 = (bytes) => btoa(String.fromCharCode(...bytes));
const BITS = Array.from({ length: 256 }, (_, i) => i.toString(2).split('1').length - 1);

const VideoPlayer = forwardRef(function VideoPlayer({ source, lessonUlid, initial, canSave, onWatched }, ref) {
    const box = useRef(null);
    const player = useRef(null);
    const map = useRef(fromBase64(initial.map));
    const state = useRef({ playing: false, lastT: null, dirty: false, position: initial.position, duration: initial.duration });
    const [, redraw] = useState(0);

    const count = () => map.current.reduce((a, b) => a + BITS[b], 0);
    const mark = (s) => {
        const i = s >> 3;
        if (i >= map.current.length) {
            const bigger = new Uint8Array(i + 1);
            bigger.set(map.current);
            map.current = bigger;
        }
        if (!(map.current[i] & (1 << (s & 7)))) {
            map.current[i] |= 1 << (s & 7);
            state.current.dirty = true;
        }
    };
    // Regista o avanço de lastT até t (até 3 s de diferença = reprodução normal, mesmo a 2×; mais = salto)
    const advance = (t) => {
        const st = state.current;
        if (st.lastT != null && t > st.lastT && t - st.lastT <= 3) {
            for (let s = st.lastT; s < t; s++) mark(s);
            onWatched?.(count(), st.duration);
        }
        st.lastT = t;
        st.position = t;
        redraw((n) => n + 1);
    };

    const save = useCallback((beacon = false) => {
        const st = state.current;
        if (!canSave || (!st.dirty && !beacon)) return;
        st.dirty = false;
        const body = { position: Math.floor(st.position || 0), map: toBase64(map.current), duration: Math.floor(st.duration || 0) || null };
        const url = `/plataforma/aulas/${lessonUlid}/progresso`;
        if (beacon && navigator.sendBeacon) {
            const fd = new FormData();
            Object.entries(body).forEach(([k, v]) => v != null && fd.append(k, v));
            fd.append('_token', document.querySelector('meta[name="csrf-token"]')?.content ?? '');
            navigator.sendBeacon(url, fd);
        } else {
            window.axios.post(url, body).catch(() => { st.dirty = true; });
        }
    }, [canSave, lessonUlid]);

    useImperativeHandle(ref, () => ({
        pause: () => {
            if (source.kind === 'youtube') player.current?.pauseVideo?.();
            if (source.kind === 'vimeo') player.current?.pause?.();
        },
    }), [source.kind]);

    useEffect(() => {
        let tick;
        let cancelled = false;
        const st = state.current;

        if (source.kind === 'youtube') {
            loadScript('https://www.youtube.com/iframe_api', () => window.YT?.Player).then(() => {
                if (cancelled) return;
                const el = document.createElement('div');
                box.current.appendChild(el);
                player.current = new window.YT.Player(el, {
                    videoId: source.id,
                    host: 'https://www.youtube-nocookie.com',
                    playerVars: { start: Math.max(0, initial.position - 2), rel: 0, modestbranding: 1, playsinline: 1 },
                    events: {
                        onReady: (e) => { st.duration = Math.floor(e.target.getDuration()) || st.duration; onWatched?.(count(), st.duration); },
                        onStateChange: (e) => {
                            st.playing = e.data === 1;
                            if (e.data === 1) st.lastT = Math.floor(e.target.getCurrentTime());
                            if (e.data === 2 || e.data === 0) save();
                        },
                    },
                });
                tick = setInterval(() => {
                    if (st.playing && player.current?.getCurrentTime) advance(Math.floor(player.current.getCurrentTime()));
                }, 1000);
            });
        } else if (source.kind === 'vimeo') {
            loadScript('https://player.vimeo.com/api/player.js', () => window.Vimeo?.Player).then(() => {
                if (cancelled) return;
                const p = new window.Vimeo.Player(box.current, { id: Number(source.id), dnt: true });
                player.current = p;
                p.ready().then(() => { if (initial.position > 2) p.setCurrentTime(initial.position - 2).catch(() => {}); });
                p.getDuration().then((d) => { st.duration = Math.floor(d) || st.duration; onWatched?.(count(), st.duration); });
                p.on('play', (d) => { st.playing = true; st.lastT = Math.floor(d?.seconds ?? 0); });
                p.on('pause', () => { st.playing = false; save(); });
                p.on('ended', () => { st.playing = false; save(); });
                p.on('timeupdate', (d) => { if (st.playing) advance(Math.floor(d.seconds)); });
            });
        } else {
            // Link externo: conta o tempo com a página visível depois de abrir o vídeo
            st.lastT = count();
            tick = setInterval(() => {
                if (st.playing && document.visibilityState === 'visible') advance((st.lastT ?? 0) + 1);
            }, 1000);
        }

        const autosave = setInterval(() => save(), 15000);
        const onHide = () => { if (document.visibilityState === 'hidden') save(true); };
        document.addEventListener('visibilitychange', onHide);
        window.addEventListener('pagehide', () => save(true));
        return () => {
            cancelled = true;
            clearInterval(tick);
            clearInterval(autosave);
            document.removeEventListener('visibilitychange', onHide);
            save(true);
            try { player.current?.destroy?.(); } catch { /* leitor já fechado */ }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [source.kind, source.id, source.url, lessonUlid]);

    if (source.kind === 'link') {
        return (
            <div className="flex aspect-video flex-col items-center justify-center gap-4 bg-ink p-6 text-center text-white">
                <p className="max-w-md text-white/80">Este vídeo abre noutro separador. O tempo conta enquanto esta página estiver aberta depois de carregares em «Abrir vídeo».</p>
                <a href={source.url} target="_blank" rel="noopener noreferrer"
                    onClick={() => { state.current.playing = true; }}
                    className="ta-cut-8 bg-accent px-5 py-3 font-display text-sm font-bold uppercase tracking-[0.04em] text-on-accent">
                    Abrir vídeo ↗
                </a>
            </div>
        );
    }

    return (
        <>
            <div ref={box} className="relative aspect-video w-full bg-black [&_iframe]:absolute [&_iframe]:inset-0 [&_iframe]:h-full [&_iframe]:w-full" />
            <WatchedBar map={map.current} duration={state.current.duration} position={state.current.position} />
        </>
    );
});

// Troços já vistos (amarelo), posição atual e a meta dos 90%
function WatchedBar({ map, duration, position }) {
    if (!duration) return null;
    const seg = [];
    let start = -1;
    for (let s = 0; s <= duration; s++) {
        const on = s < duration && map[s >> 3] & (1 << (s & 7));
        if (on && start < 0) start = s;
        if (!on && start >= 0) { seg.push([start, s]); start = -1; }
    }
    const pct = (s) => `${(s / duration) * 100}%`;
    return (
        <div className="mx-3.5 my-3 h-1.5 bg-white/20" title="O que já viste deste vídeo">
            <div className="relative h-full">
                {seg.map(([a, b]) => <i key={a} className="absolute inset-y-0 bg-accent" style={{ left: pct(a), width: pct(b - a) }} />)}
                <span className="absolute -inset-y-1 left-[90%] w-0.5 bg-white/60" aria-hidden="true" />
                <span className="absolute -inset-y-1 w-[3px] -translate-x-px bg-white" style={{ left: pct(Math.min(position || 0, duration)) }} aria-hidden="true" />
            </div>
        </div>
    );
}

export default VideoPlayer;
