import { Head, Link, router, usePage } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import StudentLayout from '@/Layouts/StudentLayout';
import '../../css/courses.css';

// Catálogo dentro da plataforma: o mesmo da landing (/cursos, courses.js), com separadores por área,
// pesquisa e aba lateral com o detalhe, mas em React e com a navbar da plataforma.

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const euro = (v) => v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const dur = (m) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}` : `${m} min`);
const textOf = (c) => `${c.title} ${c.areaName} ${c.level} ${c.description}`;
const SUGGESTIONS = ['Diagnóstico', 'OBD', 'Eletrónica', 'Bateria', 'Gestão'];

// Mantém o estado do Inertia no histórico ao mudar o ?curso= (link partilhável)
const setUrl = (search) => window.history.replaceState(window.history.state, '', location.pathname + search);

function SearchIcon({ size = 22 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="2.2" />
            <path d="M15.5 15.5L21 21" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
    );
}

function CloseIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
    );
}

function Card({ c, onOpen }) {
    return (
        <a className="cc-card" href={`?curso=${encodeURIComponent(c.slug)}`} aria-haspopup="dialog" onClick={(e) => { e.preventDefault(); onOpen(c); }}>
            <span className="cc-lift"><span className="cc-ph">
                <img src={c.image} alt="" loading="lazy" width="440" height="550" />
                {c.ai && <span className="cc-badges"><span className="cc-badge">✦ Aula com IA</span></span>}
                <span className="cc-grad" aria-hidden="true" />
                <span className="cc-txt">
                    <span className="cc-mono">{c.areaName} · {c.level}</span>
                    <span className="cc-ttl">{c.title}</span>
                    <span className="cc-meta"><span>{dur(c.minutes)} · {c.lessons} aulas</span><span className="cc-price">{euro(c.price)}</span></span>
                </span>
            </span></span>
        </a>
    );
}

// Botão do rodapé do detalhe: ir para o curso, compra pendente ou comprar (simulado)
function FootAction({ c, owned, pending }) {
    const [busy, setBusy] = useState(false);
    if (owned.includes(c.id)) {
        return <Link className="cc-cta" href={`/plataforma/cursos/${encodeURIComponent(c.slug)}`}>Ir para o curso<span aria-hidden="true">→</span></Link>;
    }
    if (pending.includes(c.id)) return <span className="cc-cta cc-wait">A aguardar autorização</span>;
    const buy = () => router.post(`/cursos/${encodeURIComponent(c.slug)}/comprar`, {}, {
        preserveState: true,
        preserveScroll: true,
        onStart: () => setBusy(true),
        onFinish: () => setBusy(false),
    });
    return (
        <button className="cc-cta" type="button" onClick={buy} disabled={busy}>
            {busy ? 'A registar…' : 'Comprar curso'}<span aria-hidden="true">→</span>
        </button>
    );
}

function Detail({ c, owned, pending, onClose }) {
    const closeRef = useRef(null);
    useEffect(() => {
        const t = setTimeout(() => closeRef.current?.focus({ preventScroll: true }), 60);
        return () => clearTimeout(t);
    }, [c.id]);

    return (
        <>
            <div className="cc-scrim" onClick={onClose} />
            <aside className="cc-drawer" role="dialog" aria-modal="true" aria-labelledby="cc-d-title">
                <div className="cc-d-scroll">
                    <div className="cc-d-hero">
                        <img src={c.image} alt="" />
                        <button ref={closeRef} className="cc-x" type="button" onClick={onClose} aria-label="Fechar detalhes do curso"><CloseIcon /></button>
                    </div>
                    <div className="cc-d-body">
                        <div className="cc-d-head">
                            <span className="cc-mono">{c.areaName} · {c.level}</span>
                            <h2 id="cc-d-title">{c.title}</h2>
                            {c.ai && <span className="cc-tag">✦ Aula com IA</span>}
                        </div>
                        <div className="cc-stats">
                            <span><small>DURAÇÃO</small><b>{dur(c.minutes)}</b></span>
                            <span><small>AULAS</small><b>{c.lessons}</b></span>
                            <span><small>MÓDULOS</small><b>{(c.modules || []).length}</b></span>
                            <span><small>FORMADOR</small><b>{c.instructor || 'A definir'}</b></span>
                        </div>
                        {c.description && <p className="cc-short">{c.description}</p>}
                        <div className="cc-prog">
                            <b>Programa</b>
                            <div className="cc-prog-box">
                                {(c.modules || []).length ? c.modules.map((m, n) => (
                                    <div className="cc-mod" key={n}>
                                        <h3><span>{String(n + 1).padStart(2, '0')}</span>{m.title}</h3>
                                        <ul>
                                            {(m.lessons || []).map((l, k) => (
                                                <li key={k}><span>{l.title}{l.ai && <span className="cc-ai">IA</span>}</span><em>{l.minutes} min</em></li>
                                            ))}
                                        </ul>
                                    </div>
                                )) : <p style={{ margin: '14px 0' }}>Programa em preparação.</p>}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="cc-d-foot">
                    <span><small>PREÇO</small><b>{euro(c.price)}</b></span>
                    <FootAction c={c} owned={owned} pending={pending} />
                </div>
            </aside>
        </>
    );
}

function Search({ initial, courses, onApply, onPick, onClose }) {
    const [v, setV] = useState(initial);
    const inputRef = useRef(null);
    useEffect(() => {
        const t = setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 60);
        return () => clearTimeout(t);
    }, []);
    const q = v.trim();
    const all = q ? courses.filter((c) => norm(textOf(c)).includes(norm(q))) : [];

    return (
        <>
            <div className="cc-scrim" onClick={onClose} />
            <div className="cc-sheet" role="dialog" aria-modal="true" aria-label="Pesquisar cursos">
                <div className="cc-sheet-in">
                    <div className="cc-field">
                        <SearchIcon size={26} />
                        <input
                            ref={inputRef}
                            type="text"
                            value={v}
                            onChange={(e) => setV(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && onApply(q)}
                            placeholder="O que quer aprender?"
                            aria-label="Pesquisar cursos"
                            autoComplete="off"
                        />
                        <button className="cc-x" type="button" onClick={onClose} aria-label="Fechar pesquisa"><CloseIcon /></button>
                    </div>
                    {!q ? (
                        <div>
                            <span className="cc-mono">Sugestões</span>
                            <div className="cc-sugg">
                                {SUGGESTIONS.map((s) => (
                                    <button key={s} className="cc-chip" type="button" onClick={() => { setV(s); inputRef.current?.focus(); }}>{s}</button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div>
                            <span className="cc-mono">{all.length} {all.length === 1 ? 'resultado' : 'resultados'}</span>
                            <div className="cc-results">
                                {all.slice(0, 6).map((c) => (
                                    <button key={c.id} className="cc-res" type="button" onClick={() => onPick(c)}>
                                        <img src={c.image} alt="" />
                                        <span style={{ flex: 1, minWidth: 0 }}><b>{c.title}</b><span className="cc-mono">{c.areaName} · {c.level}</span></span>
                                        <span className="cc-p">{euro(c.price)}</span>
                                    </button>
                                ))}
                                {all.length
                                    ? <button className="cc-pill" type="button" onClick={() => onApply(q)}>Ver todos os {all.length} resultados</button>
                                    : <span className="cc-nores">Nenhum curso encontrado. Experimente «diagnóstico», «bateria» ou «gestão».</span>}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

export default function Catalog({ courses, areas, owned, pending }) {
    const { flash } = usePage().props;
    const [area, setArea] = useState('all');
    const [query, setQuery] = useState('');
    const [detail, setDetail] = useState(null);
    const [searching, setSearching] = useState(false);
    const [notice, setNotice] = useState(null);
    const lastFocus = useRef(null);

    // Área ou curso vindos do link (/plataforma/cursos?area=slug ou ?curso=slug)
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (courses.some((c) => c.area === params.get('area'))) setArea(params.get('area'));
        const c = courses.find((x) => x.slug === params.get('curso'));
        if (c) setDetail(c);
    }, []);

    // Aviso depois de uma compra (vem da sessão)
    useEffect(() => {
        if (!flash?.status) return;
        setNotice(flash.status);
        const t = setTimeout(() => setNotice(null), 6000);
        return () => clearTimeout(t);
    }, [flash]);

    const open = (c) => {
        lastFocus.current = document.activeElement;
        setSearching(false);
        setDetail(c);
        setUrl(`?curso=${encodeURIComponent(c.slug)}`);
    };
    const close = () => {
        setDetail(null);
        setUrl('');
        lastFocus.current?.focus?.({ preventScroll: true });
    };
    const openSearch = () => { lastFocus.current = document.activeElement; setSearching(true); };
    const closeSearch = () => { setSearching(false); lastFocus.current?.focus?.({ preventScroll: true }); };
    const applySearch = (q) => { setQuery(q); setArea('all'); setSearching(false); };

    // Esc fecha; com o detalhe aberto a página não faz scroll por trás
    useEffect(() => {
        const esc = (e) => {
            if (e.key !== 'Escape') return;
            if (detail) close();
            else if (searching) closeSearch();
        };
        addEventListener('keydown', esc);
        document.body.style.overflow = detail ? 'hidden' : '';
        return () => { removeEventListener('keydown', esc); document.body.style.overflow = ''; };
    }, [detail, searching]);

    const shown = courses.filter((c) => (area === 'all' || c.area === area) && (!query || norm(textOf(c)).includes(norm(query))));
    // O detalhe aberto acompanha os dados novos depois de comprar
    const current = detail && (courses.find((c) => c.id === detail.id) ?? detail);

    return (
        <StudentLayout>
            <Head title="Cursos" />

            <div className="cc-app">
                <div className="cc">
                    <div className="cc-top">
                        <span className="cc-mono">Catálogo</span>
                        <h1>{shown.length} {shown.length === 1 ? 'curso' : 'cursos'} disponíveis</h1>
                    </div>

                    <div className="cc-filters">
                        <nav className="cc-tabs" aria-label="Filtrar por área">
                            <button className="cc-tab" type="button" aria-pressed={area === 'all'} onClick={() => setArea('all')}>Todas</button>
                            {areas.map((a) => (
                                <button key={a.slug} className="cc-tab" type="button" aria-pressed={area === a.slug} onClick={() => setArea(a.slug)}>{a.name}</button>
                            ))}
                        </nav>
                        <button className="cc-sbtn" type="button" onClick={openSearch} aria-label="Pesquisar cursos" aria-expanded={searching}>
                            <SearchIcon />
                        </button>
                    </div>
                    {query && (
                        <div className="cc-qline">A mostrar resultados para <b>«{query}»</b><button className="cc-chip" type="button" onClick={() => setQuery('')}>Limpar ✕</button></div>
                    )}

                    <div className="cc-grid">
                        {shown.map((c) => <Card key={c.id} c={c} onOpen={open} />)}
                    </div>
                    {!shown.length && (
                        <div className="cc-empty"><b>Nenhum curso corresponde a estes filtros</b><span>Limpe a pesquisa ou escolha «Todas» para ver o catálogo completo.</span></div>
                    )}
                </div>

                {searching && <Search initial={query} courses={courses} onApply={applySearch} onPick={open} onClose={closeSearch} />}
                {current && <Detail c={current} owned={owned} pending={pending} onClose={close} />}
                {notice && <div className="cc-notice" role="status">{notice}</div>}
            </div>
        </StudentLayout>
    );
}
