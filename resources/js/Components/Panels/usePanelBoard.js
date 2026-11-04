import axios from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Motor dos painéis: grelha de 24 colunas, sem sobreposições. Arrastar troca de lugar,
// redimensionar só muda a caixa que se puxa, e a disposição fica guardada por utilizador.
export const COLS = 24;
const ROW = 36;
const GAP = 12;
const MIN_W = 5;
const MIN_H = 4;
const COL_H = 2;
const EASE = 'cubic-bezier(.16, 1, .3, 1)';
const CURSOR = { e: 'ew-resize', w: 'ew-resize', s: 'ns-resize', se: 'nwse-resize', sw: 'nesw-resize' };

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const copy = (o) => JSON.parse(JSON.stringify(o));
const hit = (a, ah, b, bh) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + bh && b.y < a.y + ah;
const effH = (l, id, it) => (l.collapsed.includes(id) ? COL_H : it.h);
const shown = (l, items) => Object.keys(items).filter((id) => !l.hidden.includes(id));

function settle(l, id, it, placed) {
    const h = effH(l, id, it);
    while (placed.some((p) => hit(it, h, p.it, p.h))) it.y += 1; // empurra para baixo o que estiver no caminho
    while (it.y > 0 && !placed.some((p) => hit({ ...it, y: it.y - 1 }, h, p.it, p.h))) it.y -= 1; // e sobe até encostar
    placed.push({ it, h });
}

function compact(l, items, firstId) {
    const ids = shown(l, items);
    ids.sort((a, b) => items[a].y - items[b].y || (a === firstId ? -1 : b === firstId ? 1 : items[a].x - items[b].x));
    const placed = [];
    ids.forEach((id) => settle(l, id, items[id], placed));
    return items;
}

function arrange(l, base, id, next, origin) {
    const items = copy(base);
    Object.assign(items[id], next);
    const me = items[id];
    const h = effH(l, id, me);
    if (origin) {
        // Largar em cima de uma única caixa troca as duas, se ela couber no lugar deixado livre
        const ids = shown(l, items);
        const over = ids.filter((o) => o !== id && hit(me, h, items[o], effH(l, o, items[o])));
        const other = over.length === 1 ? items[over[0]] : null;
        const beside = other && other.y === origin.y && (other.x + other.w === origin.x || origin.x + me.w === other.x);
        if (beside) {
            if (other.x < origin.x) {
                me.x = other.x;
                other.x = me.x + me.w;
            } else {
                other.x = origin.x;
                me.x = other.x + other.w;
            }
            me.y = origin.y;
        } else if (other) {
            const oh = effH(l, over[0], other);
            const tryAt = { ...other, x: clamp(origin.x, 0, COLS - other.w), y: origin.y };
            const free = !hit(tryAt, oh, me, h)
                && !ids.some((k) => k !== id && k !== over[0] && hit(tryAt, oh, items[k], effH(l, k, items[k])));
            if (free) {
                other.x = tryAt.x;
                other.y = tryAt.y;
            }
        }
    }
    return compact(l, items, id);
}

// A caixa que se redimensiona fica no sítio. As outras mantêm o tamanho e só se afastam se ela lhes chegar
function resizeTo(l, base, id, next) {
    const items = copy(base);
    Object.assign(items[id], next);
    const placed = [{ it: items[id], h: effH(l, id, items[id]) }];
    shown(l, items)
        .filter((k) => k !== id)
        .sort((a, b) => items[a].y - items[b].y || items[a].x - items[b].x)
        .forEach((k) => settle(l, k, items[k], placed));
    return items;
}

function sizeMessage(l, id, title) {
    const it = l.items[id];
    return l.collapsed.includes(id) ? `${title}: ${it.w} colunas.` : `${title}: ${it.w} colunas por ${it.h} linhas.`;
}

function defaults(defs) {
    const ids = Object.keys(defs);
    const items = Object.fromEntries(ids.map((id) => {
        const { x, y, w, h } = defs[id];
        return [id, { x, y, w, h }];
    }));
    // No telemóvel, retomar a aula vem primeiro
    const order = ids.includes('continuar') ? ['continuar', ...ids.filter((id) => id !== 'continuar')] : ids;
    return { items, collapsed: [], hidden: [], order };
}

// Junta o que está guardado aos painéis desta página: um painel novo entra no lugar inicial
function restore(defs, saved) {
    const base = defaults(defs);
    if (!saved || !saved.items) return base;
    const ids = Object.keys(defs);
    const items = {};
    ids.forEach((id) => {
        const s = saved.items[id];
        const ok = s && ['x', 'y', 'w', 'h'].every((k) => Number.isInteger(s[k]));
        if (!ok) {
            items[id] = base.items[id];
            return;
        }
        const w = clamp(s.w, MIN_W, COLS);
        items[id] = { x: clamp(s.x, 0, COLS - w), y: Math.max(0, s.y), w, h: Math.max(s.h, MIN_H) };
    });
    const known = (list) => (Array.isArray(list) ? list.filter((id) => ids.includes(id)) : []);
    const order = known(saved.order);
    const layout = {
        items,
        collapsed: known(saved.collapsed),
        hidden: known(saved.hidden),
        order: [...order, ...base.order.filter((id) => !order.includes(id))],
    };
    layout.items = compact(layout, copy(items));
    return layout;
}

export default function usePanelBoard({ view, panels, saved }) {
    const titles = useRef({});
    titles.current = Object.fromEntries(Object.entries(panels).map(([id, p]) => [id, p.title]));
    const defs = useRef(panels);
    defs.current = panels;

    const [layout, setLayoutState] = useState(() => restore(panels, saved));
    const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 1080px)').matches);
    const [gesture, setGesture] = useState({ lifted: null, resizing: null });
    const [message, setMessage] = useState('');
    const [toast, setToast] = useState(null);
    const boardRef = useRef(null);
    const L = useRef(layout);
    const D = useRef(null);
    const R = useRef(null);
    const swallow = useRef(false);
    const saveTimer = useRef(null);
    const toastTimer = useRef(null);
    const narrowRef = useRef(narrow);
    narrowRef.current = narrow;

    const setLayout = useCallback((next) => {
        L.current = next;
        setLayoutState(next);
    }, []);
    const setItems = useCallback((items) => setLayout({ ...L.current, items }), [setLayout]);

    const persist = useCallback(() => {
        clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
            axios.put(`/plataforma/paineis/${view}`, L.current).catch(() => {
                // Sem ligação: a disposição fica nesta visita e volta a ser enviada na próxima alteração
            });
        }, 400);
    }, [view]);

    const showToast = useCallback((text) => {
        setToast(text);
        clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(null), 2600);
    }, []);

    useEffect(() => () => {
        clearTimeout(toastTimer.current);
        clearTimeout(saveTimer.current);
    }, []);

    useEffect(() => {
        const mq = window.matchMedia('(max-width: 1080px)');
        const change = () => setNarrow(mq.matches);
        change();
        mq.addEventListener('change', change);
        return () => mq.removeEventListener('change', change);
    }, []);

    useEffect(() => {
        const root = document.documentElement;
        root.classList.toggle('pn-stack', narrow);
        return () => root.classList.remove('pn-stack');
    }, [narrow]);

    // Gestos: arrastar e redimensionar com o ponteiro, teclado nas pegas
    useEffect(() => {
        const root = document.documentElement;
        const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const colStep = () => ((boardRef.current?.clientWidth ?? 0) + GAP) / COLS;
        const swallowClick = () => {
            swallow.current = true;
            setTimeout(() => { swallow.current = false; }, 0);
        };

        const gridPlace = () => {
            const d = D.current;
            const b = boardRef.current.getBoundingClientRect();
            const it = d.base[d.id];
            const x = clamp(Math.round((d.x - d.dx - b.left) / colStep()), 0, COLS - it.w);
            const y = Math.max(0, Math.round((d.y - d.dy - b.top) / ROW));
            if (d.lx === x && d.ly === y) return;
            d.lx = x;
            d.ly = y;
            setItems(arrange(L.current, d.base, d.id, { x, y }, d.origin));
        };

        // Numa só coluna, arrastar muda só a ordem
        const stackPlace = () => {
            const d = D.current;
            const o = L.current.order;
            const others = [...boardRef.current.querySelectorAll('[data-mod]')].filter((b) => b !== d.box);
            const after = others
                .filter((b) => {
                    const r = b.getBoundingClientRect();
                    return d.y > r.top + r.height / 2;
                })
                .sort((a, b) => o.indexOf(a.dataset.mod) - o.indexOf(b.dataset.mod));
            const without = o.filter((x) => x !== d.id);
            const lastAfter = after.length ? after[after.length - 1].dataset.mod : null;
            without.splice(lastAfter ? without.indexOf(lastAfter) + 1 : 0, 0, d.id);
            if (without.join() !== o.join()) setLayout({ ...L.current, order: without });
        };

        const tick = () => {
            const d = D.current;
            if (!d || !d.started) return;
            if (d.y < 90) window.scrollBy(0, -Math.ceil((90 - d.y) / 6));
            else if (d.y > window.innerHeight - 90) window.scrollBy(0, Math.ceil((d.y - (window.innerHeight - 90)) / 6));
            if (narrowRef.current) stackPlace();
            else gridPlace();
            d.raf = requestAnimationFrame(tick);
        };

        const beginDrag = () => {
            const d = D.current;
            d.started = true;
            const r = d.box.getBoundingClientRect();
            d.dx = d.sx - r.left;
            d.dy = d.sy - r.top;
            const g = d.box.cloneNode(true);
            g.classList.add('pn-ghost');
            g.removeAttribute('data-mod');
            g.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
            Object.assign(g.style, { width: `${r.width}px`, height: `${r.height}px`, transform: `translate(${r.left}px, ${r.top}px)` });
            boardRef.current.parentElement.append(g);
            d.ghost = g;
            root.classList.add('pn-grabbing');
            d.base = copy(L.current.items);
            d.origin = { x: d.base[d.id].x, y: d.base[d.id].y };
            setGesture({ lifted: d.id, resizing: null });
            tick();
        };

        const stopDrag = (cancel) => {
            const d = D.current;
            if (!d) return;
            D.current = null;
            if (!d.started) return;
            cancelAnimationFrame(d.raf);
            root.classList.remove('pn-grabbing');
            swallowClick();
            const from = d.ghost.getBoundingClientRect();
            if (cancel && d.base) setItems(d.base);
            d.ghost.remove();
            setGesture({ lifted: null, resizing: null });
            if (!cancel) {
                persist();
                setMessage(`${titles.current[d.id]} movida.`);
            }
            if (!calm && d.box.isConnected) {
                requestAnimationFrame(() => {
                    const r = d.box.getBoundingClientRect();
                    d.box.style.transition = 'none';
                    d.box.animate(
                        [{ transform: `translate(${from.left - r.left}px, ${from.top - r.top}px)` }, { transform: 'none' }],
                        { duration: 200, easing: EASE },
                    ).onfinish = () => { d.box.style.transition = ''; };
                });
            }
        };

        const moveResize = (e) => {
            const r = R.current;
            const dx = e.clientX - r.sx;
            const dy = e.clientY - r.sy;
            if (!r.moved) {
                if (Math.hypot(dx, dy) < 3) return;
                r.moved = true;
                root.classList.add('pn-grabbing');
                root.style.setProperty('cursor', L.current.collapsed.includes(r.id) ? CURSOR.e : CURSOR[r.dir]);
                setGesture({ lifted: null, resizing: r.id });
            }
            const it = r.base[r.id];
            const n = { x: it.x, w: it.w, h: it.h };
            const cols = Math.round(dx / r.step);
            const rows = Math.round(dy / ROW);
            if (r.dir.includes('e')) n.w = clamp(it.w + cols, MIN_W, COLS - it.x);
            if (r.dir.includes('w')) {
                const right = it.x + it.w;
                n.x = clamp(it.x + cols, 0, right - MIN_W);
                n.w = right - n.x;
            }
            // Minimizada, a caixa é só a barra do título: muda a largura e guarda a altura para quando abrir
            if (r.dir.includes('s') && !L.current.collapsed.includes(r.id)) n.h = clamp(it.h + rows, MIN_H, 40);
            if (n.x === r.lx && n.w === r.lw && n.h === r.lh) return;
            r.lx = n.x;
            r.lw = n.w;
            r.lh = n.h;
            setItems(resizeTo(L.current, r.base, r.id, n));
        };

        const endResize = (cancel) => {
            const r = R.current;
            R.current = null;
            if (!r || !r.moved) return;
            root.classList.remove('pn-grabbing');
            root.style.removeProperty('cursor');
            setGesture({ lifted: null, resizing: null });
            swallowClick();
            if (cancel) {
                setItems(r.base);
                return;
            }
            setItems(compact(L.current, copy(L.current.items), r.id));
            persist();
            setMessage(sizeMessage(L.current, r.id, titles.current[r.id]));
        };

        const onDown = (e) => {
            if (e.button !== 0 || !e.target.closest) return;
            const rz = e.target.closest('[data-rz]');
            if (rz && boardRef.current?.contains(rz)) {
                e.preventDefault();
                const box = rz.closest('[data-mod]');
                R.current = { id: box.dataset.mod, dir: rz.dataset.rz, pid: e.pointerId, sx: e.clientX, sy: e.clientY, moved: false, base: copy(L.current.items), step: colStep() };
                try { rz.setPointerCapture(e.pointerId); } catch { /* funciona sem captura */ }
                return;
            }
            const handle = e.target.closest('[data-drag]');
            if (!handle || !boardRef.current?.contains(handle)) return;
            const onGrip = e.target.closest('[data-grip]');
            if (!onGrip && e.target.closest('a, button, select, input, label')) return;
            if (e.pointerType === 'touch' && !onGrip) return;
            const box = handle.closest('[data-mod]');
            D.current = { box, id: box.dataset.mod, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, started: false, pid: e.pointerId };
        };
        const onMove = (e) => {
            const d = D.current;
            if (d && e.pointerId === d.pid) {
                d.x = e.clientX;
                d.y = e.clientY;
                if (!d.started) {
                    if (Math.hypot(d.x - d.sx, d.y - d.sy) < 5) return;
                    beginDrag();
                }
                d.ghost.style.transform = `translate(${d.x - d.dx}px, ${d.y - d.dy}px) scale(1.01)`;
            }
            if (R.current && e.pointerId === R.current.pid) moveResize(e);
        };
        const onUp = (e) => {
            if (D.current && e.pointerId === D.current.pid) stopDrag(false);
            if (R.current && e.pointerId === R.current.pid) endResize(false);
        };
        const onCancel = (e) => {
            if (D.current && e.pointerId === D.current.pid) stopDrag(true);
            if (R.current && e.pointerId === R.current.pid) endResize(true);
        };
        const onClick = (e) => {
            if (swallow.current) {
                e.preventDefault();
                e.stopPropagation();
            }
        };
        const onDouble = (e) => {
            const h = e.target.closest && e.target.closest('[data-corner]');
            if (!h || !boardRef.current?.contains(h)) return;
            const id = h.closest('[data-mod]').dataset.mod;
            const def = defs.current[id];
            const sized = resizeTo(L.current, L.current.items, id, { w: def.w, h: def.h, x: clamp(L.current.items[id].x, 0, COLS - def.w) });
            setItems(compact(L.current, sized, id));
            persist();
            setMessage(`${titles.current[id]}: tamanho reposto.`);
        };
        const onKey = (e) => {
            if (e.key === 'Escape') {
                if (D.current) stopDrag(true);
                if (R.current) endResize(true);
                return;
            }
            const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
            if (!arrows || !e.target.closest || !boardRef.current?.contains(e.target)) return;
            const g = e.target.closest('[data-grip]');
            const z = e.target.closest('[data-corner]');
            if (!g && !z) return;
            e.preventDefault();
            const id = e.target.closest('[data-mod]').dataset.mod;
            const l = L.current;
            const it = l.items[id];
            if (g && narrowRef.current) {
                const o = [...l.order];
                const i = o.indexOf(id);
                const j = clamp(i + arrows[0] + arrows[1], 0, o.length - 1);
                o.splice(i, 1);
                o.splice(j, 0, id);
                setLayout({ ...l, order: o });
                setMessage(`${titles.current[id]}: posição ${j + 1}.`);
            } else if (g) {
                const next = { x: clamp(it.x + arrows[0], 0, COLS - it.w), y: Math.max(0, it.y + arrows[1] * effH(l, id, it)) };
                const items = arrange(l, l.items, id, next, { x: it.x, y: it.y });
                setItems(items);
                setMessage(`${titles.current[id]}: coluna ${items[id].x + 1}, linha ${items[id].y + 1}.`);
            } else {
                const next = { w: it.w, h: l.collapsed.includes(id) ? it.h : clamp(it.h + arrows[1], MIN_H, 40), x: it.x };
                if (arrows[0]) {
                    if (z.dataset.rz === 'sw') {
                        const right = it.x + it.w;
                        next.x = clamp(it.x + arrows[0], 0, right - MIN_W);
                        next.w = right - next.x;
                    } else {
                        next.w = clamp(it.w + arrows[0], MIN_W, COLS - it.x);
                    }
                }
                setItems(compact(l, resizeTo(l, l.items, id, next), id));
                setMessage(sizeMessage(L.current, id, titles.current[id]));
            }
            persist();
        };

        document.addEventListener('pointerdown', onDown);
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
        document.addEventListener('pointercancel', onCancel);
        document.addEventListener('click', onClick, true);
        document.addEventListener('dblclick', onDouble);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('pointerdown', onDown);
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
            document.removeEventListener('pointercancel', onCancel);
            document.removeEventListener('click', onClick, true);
            document.removeEventListener('dblclick', onDouble);
            document.removeEventListener('keydown', onKey);
            // Um gesto a meio não passa para a página seguinte
            if (D.current?.ghost) D.current.ghost.remove();
            if (D.current?.raf) cancelAnimationFrame(D.current.raf);
            D.current = null;
            R.current = null;
            root.classList.remove('pn-grabbing');
            root.style.removeProperty('cursor');
        };
    }, [persist, setItems, setLayout]);

    const toggleFold = useCallback((id) => {
        const l = L.current;
        const closing = !l.collapsed.includes(id);
        const next = { ...l, collapsed: closing ? [...l.collapsed, id] : l.collapsed.filter((x) => x !== id) };
        next.items = arrange(next, next.items, id, {});
        setLayout(next);
        persist();
        setMessage(`${titles.current[id]} ${closing ? 'minimizada' : 'aberta'}.`);
    }, [persist, setLayout]);

    const hide = useCallback((id) => {
        const l = L.current;
        const next = { ...l, hidden: [...l.hidden, id] };
        next.items = compact(next, copy(l.items));
        setLayout(next);
        persist();
        showToast(`${titles.current[id]} fechado. Volta a abri-lo em Painéis visíveis, no topo.`);
    }, [persist, setLayout, showToast]);

    const show = useCallback((id) => {
        const l = L.current;
        const next = { ...l, hidden: l.hidden.filter((x) => x !== id) };
        next.items = arrange(next, l.items, id, {}); // volta ao lugar onde estava
        setLayout(next);
        persist();
    }, [persist, setLayout]);

    const reset = useCallback(() => {
        clearTimeout(saveTimer.current);
        setLayout(defaults(defs.current));
        axios.delete(`/plataforma/paineis/${view}`).catch(() => {});
    }, [setLayout, view]);

    const rows = useMemo(() => {
        const r = shown(layout, layout.items).reduce((max, id) => {
            const it = layout.items[id];
            return Math.max(max, it.y + effH(layout, id, it));
        }, 0);
        return r + (gesture.lifted ? 6 : 0);
    }, [layout, gesture.lifted]);

    const flags = useCallback((id) => {
        const it = layout.items[id];
        const h = effH(layout, id, it);
        const vis = shown(layout, layout.items).filter((k) => k !== id);
        return {
            collapsed: layout.collapsed.includes(id),
            h,
            atRight: it.x + it.w === COLS,
            hasRight: vis.some((k) => {
                const o = layout.items[k];
                return o.x === it.x + it.w && o.y < it.y + h && it.y < o.y + effH(layout, k, o);
            }),
            hasBelow: vis.some((k) => {
                const o = layout.items[k];
                return o.y === it.y + h && o.x < it.x + it.w && it.x < o.x + o.w;
            }),
        };
    }, [layout]);

    return {
        layout, narrow, gesture, rows, message, toast, boardRef, flags, toggleFold, hide, show, reset, showToast,
        panels,
        titles: titles.current,
        visible: shown(layout, layout.items),
    };
}
