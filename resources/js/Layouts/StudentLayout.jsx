import { Link, usePage } from '@inertiajs/react';
import Dropdown from '@/Components/Dropdown';
import { useEffect, useRef, useState } from 'react';
import useTheme from '@/hooks/useTheme';
import {
    IconBook, IconCatalog, IconCreate, IconDoc, IconHome, IconInbox, IconMoon, IconSun, IconTeam, IconTest, IconUser,
} from '@/Components/Panels/icons';

// Navegação da plataforma (a aparência decidida a 2026-11-04): logótipo e opções à esquerda.
const baseNav = [
    { key: 'home', label: 'Início', href: '/dashboard', Icon: IconHome },
    { key: 'mine', label: 'Os meus cursos', short: 'Cursos', href: '/plataforma/meus-cursos', Icon: IconBook },
    { key: 'tests', label: 'Avaliações', href: '/plataforma/avaliacoes', Icon: IconTest },
    { key: 'docs', label: 'Documentos', href: '/plataforma/documentos', Icon: IconDoc },
    { key: 'catalog', label: 'Catálogo', href: '/plataforma/cursos', Icon: IconCatalog, exact: true },
];
const requestsItem = { key: 'requests', label: 'Pedidos', href: '/gestao/pedidos', Icon: IconInbox, badge: true };
const teamsItem = { key: 'teams', label: 'Equipas', href: '/gestao/equipas', Icon: IconTeam };

// Cada perfil vê as suas opções: Equipas (team leader), Pedidos/Equipas (gestor de cursos e admin), cursos (formador/admin)
function navFor(role) {
    switch (role) {
        case 'team_leader':
            return [...baseNav, { key: 'team', label: 'Equipas', href: '/equipa', Icon: IconTeam }];
        case 'gestor_cursos':
            return [...baseNav, requestsItem, teamsItem];
        case 'formador':
            return [...baseNav, { key: 'builder', label: 'Criar cursos', short: 'Criar', href: '/formador/cursos', Icon: IconCreate, tag: 'Formador' }];
        case 'admin':
            return [...baseNav, requestsItem, teamsItem, { key: 'builder', label: 'Gerir cursos', short: 'Gerir', href: '/formador/cursos', Icon: IconCreate, tag: 'Admin' }];
        default:
            return baseNav;
    }
}

function Count({ n }) {
    if (!n) return null;
    return <span className="pn-count">{n > 99 ? '99+' : n}</span>;
}

// Sino do Gestor de Cursos/admin: pedidos novos
function Bell({ inbox }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
        if (!open) return undefined;
        const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
        const esc = (e) => e.key === 'Escape' && setOpen(false);
        document.addEventListener('pointerdown', close);
        document.addEventListener('keydown', esc);
        return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); };
    }, [open]);

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                aria-label={`Notificações${inbox.count ? `: ${inbox.count} pedidos novos` : ''}`}
                aria-expanded={open}
                onClick={() => setOpen((o) => !o)}
                className="pn-icon relative"
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
                </svg>
                {inbox.count > 0 && <span className="pn-count absolute -right-1 -top-1" style={{ margin: 0 }}>{inbox.count > 99 ? '99+' : inbox.count}</span>}
            </button>
            {open && (
                <div className="absolute right-0 top-12 z-40 w-[320px] max-w-[calc(100vw-32px)] bg-surface shadow-[0_14px_40px_rgba(0,0,0,.18)]">
                    <p className="border-b border-line px-4 py-3 text-sm font-bold">Pedidos novos</p>
                    {inbox.items.length ? inbox.items.map((r) => (
                        <Link key={r.id} href={`/gestao/pedidos?pedido=${r.id}`} onClick={() => setOpen(false)} className="block border-b border-line px-4 py-3 text-sm hover:bg-page">
                            <b>#{r.id}</b> · {r.kind}
                            <small className="block text-xs text-muted">{r.who} · {r.ago}</small>
                        </Link>
                    )) : <p className="px-4 py-6 text-center text-sm text-muted">Sem pedidos novos.</p>}
                    <Link href="/gestao/pedidos" onClick={() => setOpen(false)} className="block px-4 py-3 text-center text-[13px] font-semibold underline underline-offset-4">
                        Ver todos os pedidos
                    </Link>
                </div>
            )}
        </div>
    );
}

export function initials(name = '') {
    return name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((n) => n[0])
        .join('')
        .toUpperCase();
}

export function formatXp(n = 0) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export default function StudentLayout({ children, navTools }) {
    const { auth, staffInbox, access } = usePage().props;
    const currentUrl = usePage().url;
    const user = auth?.user ?? {};
    const navItems = navFor(auth?.role);
    const { theme, toggle } = useTheme();
    const dark = theme === 'dark';
    const [notice, setNotice] = useState(null);
    const noticeTimer = useRef(null);
    useEffect(() => () => clearTimeout(noticeTimer.current), []);

    const langNotice = () => {
        setNotice('Para já, a plataforma só existe em português.');
        clearTimeout(noticeTimer.current);
        noticeTimer.current = setTimeout(() => setNotice(null), 2600);
    };

    const isActive = ({ href, exact }) => {
        const path = currentUrl.split('?')[0];
        return path === href || (!exact && path.startsWith(`${href}/`));
    };
    // Páginas de um curso: contam como "Os meus cursos" para quem está inscrito e como "Catálogo" para os outros
    const inCourse = currentUrl.startsWith('/plataforma/cursos/');
    const enrolled = access?.mode === 'enrolled';
    const active = (item) => isActive(item)
        || (inCourse && item.key === (enrolled ? 'mine' : 'catalog'));

    return (
        <div className="min-h-screen bg-page text-ink">
            <header className="pn-nav">
                <Link href="/dashboard" className="pn-logo" aria-label="T.Academy, início">
                    <img className="ta-logo-light" src="/images/brand/logo-nav.png" alt="T.Academy" />
                    <img className="ta-logo-dark" src="/images/brand/logo-nav-dark.png" alt="" />
                </Link>
                <nav className="pn-nav-links" aria-label="Principal">
                    {navItems.map((item) => (
                        <Link key={item.key} href={item.href} className={active(item) ? 'pn-on' : undefined} aria-current={active(item) ? 'page' : undefined}>
                            {item.label}
                            {item.badge && <Count n={staffInbox?.count} />}
                            {item.tag && <span className="pn-tag">{item.tag}</span>}
                        </Link>
                    ))}
                </nav>
                <div className="pn-nav-end">
                    {navTools}
                    {staffInbox && <Bell inbox={staffInbox} />}
                    <button type="button" className="pn-lang" onClick={langNotice}>PT · EN</button>
                    <button type="button" className="pn-icon" onClick={toggle} aria-label={dark ? 'Mudar para tema claro' : 'Mudar para tema escuro'} title={dark ? 'Tema claro' : 'Tema escuro'}>
                        {dark ? <IconSun /> : <IconMoon />}
                    </button>
                    <Dropdown>
                        <Dropdown.Trigger>
                            <button type="button" aria-label="Menu da conta" className="pn-account"><IconUser /></button>
                        </Dropdown.Trigger>
                        <Dropdown.Content>
                            <div className="border-b border-line px-4 py-3">
                                <p className="truncate text-sm font-bold text-ink">{user.name ?? 'Aluno'}</p>
                                <p className="truncate text-xs text-muted">{user.email}</p>
                            </div>
                            <Dropdown.Link href="/profile">Perfil</Dropdown.Link>
                            <Dropdown.Link href="/logout" method="post" as="button">Terminar sessão</Dropdown.Link>
                        </Dropdown.Content>
                    </Dropdown>
                </div>
            </header>

            <main className="pn-main">{children}</main>

            {/* Barra de baixo (janelas estreitas): mesma navegação da barra de cima */}
            <nav className="pn-tabbar" aria-label="Principal">
                {navItems.map((item) => {
                    const { key, label, short, href, Icon, badge } = item;
                    return (
                        <Link key={key} href={href} aria-label={label} className={active(item) ? 'pn-on' : undefined} aria-current={active(item) ? 'page' : undefined}>
                            <Icon />
                            {badge && <Count n={staffInbox?.count} />}
                            {short ?? label}
                        </Link>
                    );
                })}
            </nav>

            <div className={`pn-toast ${notice ? 'pn-on' : ''}`} role="status">{notice}</div>
        </div>
    );
}
