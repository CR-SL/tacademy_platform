import { router } from '@inertiajs/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { t } from '@/i18n';

// Lupa do topo (2026-11-23, desenho do colega): abre uma barra por baixo da navegação, a toda a largura.
// Procura só em categorias e cursos (2026-11-24); os resultados aparecem numa lista por baixo do campo.
// Atalhos: "/" ou Ctrl/⌘+K abrem; setas escolhem; Enter abre; Esc fecha.


export function SearchIcon({ size = 20 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.7" />
            <path d="M15.5 15.5L20.5 20.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
    );
}

function FileIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
            <path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4" />
        </svg>
    );
}

// Partes do título que correspondem à pesquisa, a negrito (sem contar acentos nem maiúsculas)
const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function Mark({ text, words }) {
    const f = fold(text);
    const marks = new Array(text.length).fill(false);
    words.forEach((w) => {
        let i = f.indexOf(w);
        while (w && i !== -1) { for (let k = i; k < i + w.length; k++) marks[k] = true; i = f.indexOf(w, i + w.length); }
    });
    const parts = [];
    let start = 0;
    for (let i = 1; i <= text.length; i++) {
        if (i === text.length || marks[i] !== marks[start]) { parts.push([text.slice(start, i), marks[start]]); start = i; }
    }
    return parts.map(([s, on], i) => (on ? <b key={i}>{s}</b> : <span key={i}>{s}</span>));
}

export default function TopSearch() {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState('');
    const [res, setRes] = useState(null);
    const [busy, setBusy] = useState(false);
    const [cursor, setCursor] = useState(0);
    const [top, setTop] = useState(64);
    const box = useRef(null);
    const input = useRef(null);
    const button = useRef(null);
    const listId = 'ts-results';

    const close = (refocus = true) => {
        setOpen(false);
        if (refocus) button.current?.focus();
    };

    // Atalhos para abrir
    useEffect(() => {
        const onKey = (e) => {
            const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
            if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) {
                e.preventDefault();
                setOpen(true);
            }
        };
        addEventListener('keydown', onKey);
        return () => removeEventListener('keydown', onKey);
    }, []);

    // Ao abrir, o cursor vai para o campo; um clique fora fecha
    useEffect(() => {
        if (!open) return undefined;
        // A barra fica colada por baixo da navegação (fixa: a navegação também fica no topo ao descer a página)
        setTop(Math.max(0, button.current?.closest('header')?.getBoundingClientRect().bottom ?? 64));
        input.current?.focus();
        input.current?.select();
        const out = (e) => { if (!box.current?.contains(e.target) && !button.current?.contains(e.target)) close(false); };
        document.addEventListener('pointerdown', out);
        return () => document.removeEventListener('pointerdown', out);
    }, [open]);

    // Mudar de página fecha a pesquisa
    useEffect(() => router.on('navigate', () => setOpen(false)), []);

    // Procura enquanto se escreve (espera 200 ms depois da última tecla)
    useEffect(() => {
        const term = q.trim();
        if (term.length < 2) { setRes(null); setBusy(false); return undefined; }
        setBusy(true);
        const ctrl = new AbortController();
        const timer = setTimeout(() => {
            window.axios.get('/plataforma/pesquisa', { params: { q: term }, signal: ctrl.signal })
                .then(({ data }) => { setRes(data); setCursor(0); setBusy(false); })
                .catch((e) => { if (e?.code !== 'ERR_CANCELED') { setRes({ groups: [], error: true }); setBusy(false); } });
        }, 200);
        return () => { clearTimeout(timer); ctrl.abort(); };
    }, [q]);

    const words = useMemo(() => fold(q).split(/\s+/).filter((w) => w.length >= 2 || /^\d$/.test(w)), [q]);
    const flat = useMemo(() => (res ? res.groups.flatMap((g) => g.items) : []), [res]);

    const go = (item) => {
        if (item.file) { window.open(item.url, '_blank', 'noopener'); return; }
        setOpen(false);
        router.visit(item.url);
    };

    const onKeyDown = (e) => {
        if (e.key === 'Escape') { e.preventDefault(); if (q) setQ(''); else close(); }
        else if (e.key === 'ArrowDown' && flat.length) { e.preventDefault(); setCursor((c) => (c + 1) % flat.length); }
        else if (e.key === 'ArrowUp' && flat.length) { e.preventDefault(); setCursor((c) => (c - 1 + flat.length) % flat.length); }
        else if (e.key === 'Enter' && flat[cursor]) { e.preventDefault(); go(flat[cursor]); }
    };

    // Mantém a opção escolhida com as setas à vista
    useEffect(() => {
        box.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
    }, [cursor]);

    let n = -1;
    const group = (g) => (
        <div key={g.key} className="ts-group" role="group" aria-label={g.title}>
            <div className="ts-ghead">
                <span>{g.title}</span>
                {g.total > g.items.length && <span>{t(':shown de :total', { shown: g.items.length, total: g.total })}</span>}
            </div>
            {g.items.map((item) => {
                n += 1;
                const i = n;
                return (
                    <a
                        key={`${g.key}-${i}`}
                        id={`ts-opt-${i}`}
                        role="option"
                        aria-selected={i === cursor}
                        href={item.url}
                        target={item.file ? '_blank' : undefined}
                        rel={item.file ? 'noopener' : undefined}
                        className="ts-item"
                        onMouseMove={() => setCursor(i)}
                        onClick={(e) => { if (!item.file && !e.ctrlKey && !e.metaKey) { e.preventDefault(); go(item); } }}
                    >
                        {item.file && <span className="ts-file"><FileIcon /></span>}
                        <span className="ts-text">
                            <span className="ts-title"><Mark text={item.title} words={words} /></span>
                            {item.meta && <span className="ts-meta">{item.meta}</span>}
                        </span>
                        <span className="ts-enter" aria-hidden="true">↵</span>
                    </a>
                );
            })}
        </div>
    );

    const empty = res && !flat.length;
    const placeholder = t('Pesquisar cursos e categorias…');

    return (
        <>
            <button
                ref={button}
                type="button"
                className="pn-icon"
                aria-label={t('Pesquisar')}
                title={t('Pesquisar (/)')}
                aria-expanded={open}
                aria-controls="ts-bar"
                onClick={() => (open ? close() : setOpen(true))}
            >
                <SearchIcon />
            </button>

            {open && (
                <div id="ts-bar" ref={box} className="ts-bar" role="search" style={{ top }}>
                    <div className="ts-inner">
                        <label className="ts-field">
                            <SearchIcon size={18} />
                            <span className="sr-only">{placeholder}</span>
                            <input
                                ref={input}
                                type="search"
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                onKeyDown={onKeyDown}
                                placeholder={placeholder}
                                autoComplete="off"
                                spellCheck="false"
                                role="combobox"
                                aria-expanded={!!res}
                                aria-controls={listId}
                                aria-activedescendant={flat.length ? `ts-opt-${cursor}` : undefined}
                            />
                            {busy && <span className="ts-busy" aria-hidden="true" />}
                            <kbd className="ts-kbd" aria-hidden="true">Esc</kbd>
                        </label>

                        {res && (
                            <div id={listId} className="ts-results" role="listbox" aria-label={t('Resultados')}>
                                {res.error && <p className="ts-empty">{t('Não foi possível pesquisar agora. Tenta outra vez.')}</p>}
                                {empty && !res.error && (
                                    <p className="ts-empty">{t('Nada encontrado para «:q».', { q: q.trim() })}</p>
                                )}
                                {res.groups.map(group)}
                            </div>
                        )}
                        <p className="sr-only" aria-live="polite">
                            {res && !busy ? (flat.length ? t(':n resultados', { n: flat.length }) : t('Sem resultados')) : ''}
                        </p>
                    </div>
                </div>
            )}
        </>
    );
}
