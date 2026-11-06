import { useCallback, useEffect, useRef, useState } from 'react';

// "Arrumar a oficina": minijogo de peças que caem, para uma pausa entre aulas.
// Cada peça é uma caixa de material; uma prateleira cheia fica arrumada e sai.
// O teclado só responde com o jogo em foco, e o jogo pára quando se sai dele.

const COLS = 10;
const ROWS = 18;
const BEST_KEY = 'ta-pausa-recorde';

// Formas (4 blocos), com o nome da peça da oficina e a cor
const PIECES = [
    { name: 'Correia', color: '#F8B101', cells: [[0, 1], [1, 1], [2, 1], [3, 1]] },
    { name: 'Bateria', color: '#B37D00', cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
    { name: 'Macaco', color: '#4F6D8A', cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
    { name: 'Escape', color: '#8A8F98', cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
    { name: 'Pastilhas', color: '#B5562E', cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
    { name: 'Chave', color: '#6D7A3A', cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
    { name: 'Filtro', color: '#A8916A', cells: [[2, 0], [0, 1], [1, 1], [2, 1]] },
];

const POINTS = [0, 100, 300, 500, 800];
const speed = (level) => Math.max(110, 800 - (level - 1) * 70);

const emptyGrid = () => Array.from({ length: ROWS }, () => Array(COLS).fill(null));

function readBest() {
    try { return Number(window.localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; }
}
function saveBest(n) {
    try { window.localStorage.setItem(BEST_KEY, String(n)); } catch { /* sem armazenamento: fica só nesta visita */ }
}

// Saco com as 7 peças baralhadas: nunca há secas longas da mesma peça
function makeBag() {
    const bag = PIECES.map((_, i) => i);
    for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    return bag;
}

function rotate(cells) {
    // Roda 90° e volta a encostar ao canto
    const r = cells.map(([x, y]) => [-y, x]);
    const minX = Math.min(...r.map((c) => c[0]));
    const minY = Math.min(...r.map((c) => c[1]));
    return r.map(([x, y]) => [x - minX, y - minY]);
}

function fits(grid, cells, px, py) {
    return cells.every(([x, y]) => {
        const gx = px + x;
        const gy = py + y;
        return gx >= 0 && gx < COLS && gy < ROWS && (gy < 0 || !grid[gy][gx]);
    });
}

function cssVar(el, name, fallback) {
    return getComputedStyle(el).getPropertyValue(name).trim() || fallback;
}

// Caixa de material: cor, aresta de luz, sombra e um parafuso no canto
function drawCrate(ctx, x, y, s, color, alpha = 1) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
    ctx.fillStyle = 'rgba(255,255,255,.22)';
    ctx.fillRect(x + 1, y + 1, s - 2, Math.max(2, s * 0.12));
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    ctx.fillRect(x + 1, y + s - 1 - Math.max(2, s * 0.12), s - 2, Math.max(2, s * 0.12));
    if (s >= 14) {
        ctx.fillStyle = 'rgba(0,0,0,.28)';
        ctx.beginPath();
        ctx.arc(x + s * 0.74, y + s * 0.34, Math.max(1.5, s * 0.08), 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

export default function WorkshopGame({ onBest }) {
    const wrapRef = useRef(null);
    const boardRef = useRef(null);
    const canvasRef = useRef(null);
    const nextRef = useRef(null);
    const game = useRef(null);
    const [cell, setCell] = useState(20);
    const [status, setStatus] = useState('idle'); // idle | playing | paused | over
    const [stats, setStats] = useState({ score: 0, lines: 0, level: 1 });
    const [nextName, setNextName] = useState(null);
    const [best, setBest] = useState(0);
    const [announce, setAnnounce] = useState('');

    useEffect(() => {
        const b = readBest();
        setBest(b);
        onBest?.(b);
    }, [onBest]);

    // O tabuleiro ocupa a altura que a caixa tiver; ao redimensionar a caixa, as peças acompanham
    useEffect(() => {
        const el = boardRef.current;
        if (!el) return undefined;
        const fit = () => {
            const s = Math.floor(Math.min(el.clientHeight / ROWS, el.clientWidth / COLS));
            setCell(Math.max(8, s));
        };
        fit();
        const ro = new ResizeObserver(fit);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        const g = game.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const s = cell;
        const dpr = window.devicePixelRatio || 1;
        if (canvas.width !== COLS * s * dpr) {
            canvas.width = COLS * s * dpr;
            canvas.height = ROWS * s * dpr;
            canvas.style.width = `${COLS * s}px`;
            canvas.style.height = `${ROWS * s}px`;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const bg = cssVar(canvas, '--color-surface2', '#EFEBE4');
        const dot = cssVar(canvas, '--color-pill', '#D9D5CB');
        const line = cssVar(canvas, '--color-line', '#E7E4DD');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, COLS * s, ROWS * s);
        // Painel de ferramentas furado e as prateleiras
        ctx.fillStyle = dot;
        for (let y = 0; y < ROWS; y++) {
            for (let x = 0; x < COLS; x++) {
                ctx.fillRect(x * s + s / 2 - 1, y * s + s / 2 - 1, 2, 2);
            }
        }
        ctx.fillStyle = line;
        for (let y = 1; y <= ROWS; y++) ctx.fillRect(0, y * s - 1, COLS * s, 1);

        if (!g) return;
        g.grid.forEach((row, y) => row.forEach((c, x) => c && drawCrate(ctx, x * s, y * s, s, c)));
        if (g.piece) {
            const { cells, x: px, y: py, color } = g.piece;
            // Sombra: onde a peça vai cair
            let gy = py;
            while (fits(g.grid, cells, px, gy + 1)) gy++;
            cells.forEach(([x, y]) => {
                if (gy + y < 0) return;
                ctx.strokeStyle = color;
                ctx.lineWidth = 1.5;
                ctx.globalAlpha = 0.55;
                ctx.strokeRect((px + x) * s + 2.5, (gy + y) * s + 2.5, s - 5, s - 5);
                ctx.globalAlpha = 1;
            });
            cells.forEach(([x, y]) => py + y >= 0 && drawCrate(ctx, (px + x) * s, (py + y) * s, s, color));
        }
    }, [cell]);

    const drawNext = useCallback(() => {
        const canvas = nextRef.current;
        const g = game.current;
        if (!canvas) return;
        const s = 14;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = 4 * s * dpr;
        canvas.height = 2 * s * dpr;
        canvas.style.width = `${4 * s}px`;
        canvas.style.height = `${2 * s}px`;
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, 4 * s, 2 * s);
        if (!g) return;
        const p = PIECES[g.queue[0]];
        const w = Math.max(...p.cells.map((c) => c[0])) + 1;
        const ox = ((4 - w) * s) / 2;
        p.cells.forEach(([x, y]) => drawCrate(ctx, ox + x * s, y * s, s, p.color));
    }, []);

    useEffect(() => { draw(); }, [draw, status, stats]);

    const spawn = useCallback(() => {
        const g = game.current;
        if (g.queue.length < 2) g.queue.push(...makeBag());
        const p = PIECES[g.queue.shift()];
        const w = Math.max(...p.cells.map((c) => c[0])) + 1;
        g.piece = { cells: p.cells, color: p.color, x: Math.floor((COLS - w) / 2), y: -1 };
        setNextName(PIECES[g.queue[0]].name);
        drawNext();
        if (!fits(g.grid, g.piece.cells, g.piece.x, g.piece.y)) {
            g.piece = null;
            setStatus('over');
            const total = g.score;
            setAnnounce(`As prateleiras encheram. ${total} pontos.`);
            if (total > readBest()) {
                saveBest(total);
                setBest(total);
                onBest?.(total);
            }
        }
    }, [drawNext, onBest]);

    const lock = useCallback(() => {
        const g = game.current;
        const { cells, x: px, y: py, color } = g.piece;
        cells.forEach(([x, y]) => { if (py + y >= 0) g.grid[py + y][px + x] = color; });
        const kept = g.grid.filter((row) => row.some((c) => !c));
        const cleared = ROWS - kept.length;
        if (cleared) {
            g.grid = [...Array.from({ length: cleared }, () => Array(COLS).fill(null)), ...kept];
            g.lines += cleared;
            g.score += POINTS[cleared] * g.level;
            const level = Math.floor(g.lines / 10) + 1;
            if (level !== g.level) {
                g.level = level;
                setAnnounce(`Nível ${level}.`);
            }
            setStats({ score: g.score, lines: g.lines, level: g.level });
        }
        spawn();
    }, [spawn]);

    const step = useCallback(() => {
        const g = game.current;
        if (!g?.piece) return;
        if (fits(g.grid, g.piece.cells, g.piece.x, g.piece.y + 1)) g.piece.y += 1;
        else lock();
        draw();
    }, [draw, lock]);

    // Relógio da queda
    useEffect(() => {
        if (status !== 'playing') return undefined;
        const t = setInterval(step, speed(stats.level));
        return () => clearInterval(t);
    }, [status, stats.level, step]);

    const start = () => {
        game.current = { grid: emptyGrid(), queue: [...makeBag(), ...makeBag()], piece: null, score: 0, lines: 0, level: 1 };
        setStats({ score: 0, lines: 0, level: 1 });
        spawn();
        setStatus('playing');
        setAnnounce('Jogo começado.');
        boardRef.current?.focus();
    };
    const pause = useCallback(() => setStatus((s) => (s === 'playing' ? 'paused' : s)), []);
    const resume = () => {
        setStatus('playing');
        boardRef.current?.focus();
    };

    const act = useCallback((kind) => {
        const g = game.current;
        if (status !== 'playing' || !g?.piece) return;
        const p = g.piece;
        if (kind === 'left' && fits(g.grid, p.cells, p.x - 1, p.y)) p.x -= 1;
        if (kind === 'right' && fits(g.grid, p.cells, p.x + 1, p.y)) p.x += 1;
        if (kind === 'rotate') {
            const r = rotate(p.cells);
            const kick = [0, -1, 1, -2, 2].find((dx) => fits(g.grid, r, p.x + dx, p.y));
            if (kick !== undefined) {
                p.cells = r;
                p.x += kick;
            }
        }
        if (kind === 'down') {
            if (fits(g.grid, p.cells, p.x, p.y + 1)) {
                p.y += 1;
                g.score += 1;
                setStats((st) => ({ ...st, score: g.score }));
            } else lock();
        }
        if (kind === 'drop') {
            let n = 0;
            while (fits(g.grid, p.cells, p.x, p.y + 1)) { p.y += 1; n++; }
            g.score += n * 2;
            setStats((st) => ({ ...st, score: g.score }));
            lock();
        }
        draw();
    }, [status, draw, lock]);

    const onKey = (e) => {
        const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'rotate', x: 'rotate', X: 'rotate', ArrowDown: 'down', ' ': 'drop' };
        if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
            if (status === 'playing') { e.preventDefault(); pause(); }
            else if (status === 'paused' && e.key !== 'Escape') { e.preventDefault(); resume(); }
            return;
        }
        if (e.key === 'Enter' && status !== 'playing') {
            e.preventDefault();
            if (status === 'paused') resume(); else start();
            return;
        }
        if (map[e.key] && status === 'playing') {
            e.preventDefault();
            act(map[e.key]);
        }
    };

    // Pára quando se sai do jogo, se esconde o separador ou a caixa deixa de se ver
    useEffect(() => {
        const wrap = wrapRef.current;
        const out = (e) => { if (!wrap.contains(e.relatedTarget)) pause(); };
        const hidden = () => { if (document.hidden) pause(); };
        wrap.addEventListener('focusout', out);
        document.addEventListener('visibilitychange', hidden);
        const io = new IntersectionObserver(([entry]) => { if (!entry.isIntersecting) pause(); });
        io.observe(wrap);
        return () => {
            wrap.removeEventListener('focusout', out);
            document.removeEventListener('visibilitychange', hidden);
            io.disconnect();
        };
    }, [pause]);

    const overlay = {
        idle: { title: 'Pausa na oficina', text: 'Arruma as caixas nas prateleiras. Cada prateleira cheia fica arrumada e sai.', cta: 'Começar', onClick: start },
        paused: { title: 'Em pausa', text: 'O jogo espera por ti.', cta: 'Continuar', onClick: resume },
        over: { title: 'As prateleiras encheram', text: `Arrumaste ${stats.lines} ${stats.lines === 1 ? 'prateleira' : 'prateleiras'} e fizeste ${stats.score} pontos.${stats.score > 0 && stats.score >= best ? ' É o teu recorde!' : ''}`, cta: 'Jogar outra vez', onClick: start },
    }[status];

    return (
        <div className="pn-game" ref={wrapRef} onKeyDown={onKey}>
            <div
                className="pn-game-board"
                ref={boardRef}
                tabIndex={0}
                role="application"
                aria-label="Arrumar a oficina. Setas para mover, seta para cima roda, seta para baixo desce, espaço larga, P pausa."
                onClick={() => boardRef.current?.focus()}
            >
                <div className="pn-game-well" style={{ width: COLS * cell, height: ROWS * cell }}>
                    <canvas ref={canvasRef} aria-hidden="true" />
                    {overlay && (
                        <div className="pn-game-ov">
                            <b className="pn-disp">{overlay.title}</b>
                            <p>{overlay.text}</p>
                            <button type="button" className="pn-btn pn-sm" onClick={overlay.onClick}>{overlay.cta}</button>
                        </div>
                    )}
                </div>
            </div>
            <div className="pn-game-side">
                <dl className="pn-game-nums">
                    <div><dt className="pn-lab">Pontos</dt><dd className="pn-disp">{stats.score}</dd></div>
                    <div><dt className="pn-lab">Prateleiras</dt><dd className="pn-disp">{stats.lines}</dd></div>
                    <div><dt className="pn-lab">Nível</dt><dd className="pn-disp">{stats.level}</dd></div>
                    <div><dt className="pn-lab">Recorde</dt><dd className="pn-disp">{best}</dd></div>
                </dl>
                <div className="pn-game-stat">
                    <span className="pn-lab">A seguir{nextName ? ` · ${nextName}` : ''}</span>
                    <canvas ref={nextRef} width={56} height={28} style={{ width: 56, height: 28 }} aria-hidden="true" />
                </div>
                <div className="pn-game-pad" role="group" aria-label="Comandos">
                    <button type="button" aria-label="Mover para a esquerda" onClick={() => act('left')}>◀</button>
                    <button type="button" aria-label="Rodar" onClick={() => act('rotate')}>⟳</button>
                    <button type="button" aria-label="Mover para a direita" onClick={() => act('right')}>▶</button>
                    <button type="button" aria-label="Descer" onClick={() => act('down')}>▼</button>
                    <button type="button" aria-label="Largar" className="pn-game-wide" onClick={() => act('drop')}>Largar</button>
                </div>
                {status === 'playing' && <button type="button" className="pn-link pn-game-pause" onClick={pause}>Pausa</button>}
                <p className="pn-game-help">Setas · ↑ roda · espaço larga · P pausa</p>
            </div>
            <span className="pn-sr" aria-live="polite">{announce}</span>
        </div>
    );
}
