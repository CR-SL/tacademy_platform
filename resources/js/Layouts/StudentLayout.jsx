import { Link, usePage } from '@inertiajs/react';
import Dropdown from '@/Components/Dropdown';
import Logo from '@/Components/Logo';
import ThemeToggle from '@/Components/ThemeToggle';
import { useEffect, useRef, useState } from 'react';
import { CatalogIcon, CreateCourseIcon, GoalsIcon, RequestsIcon, TeamIcon } from '@/Components/NavIcons';

// Navegação da topbar (direção 4b)
const baseNav = [
    { key: 'tasks', label: 'Tarefas', href: '/dashboard', Icon: GoalsIcon },
    { key: 'courses', label: 'Cursos', href: '/plataforma/cursos', Icon: CatalogIcon },
];
const requestsItem = { key: 'requests', label: 'Pedidos', href: '/gestao/pedidos', Icon: RequestsIcon, badge: true };
const teamsItem = { key: 'teams', label: 'Equipas', href: '/gestao/equipas', Icon: TeamIcon };

// Cada perfil vê as suas opções: Equipa (team leader), Pedidos/Equipas (gestor de cursos e admin), cursos (formador/admin)
function navFor(role) {
    switch (role) {
        case 'team_leader':
            return [...baseNav, { key: 'team', label: 'Equipa', href: '/equipa', Icon: TeamIcon }];
        case 'gestor_cursos':
            return [...baseNav, requestsItem, teamsItem];
        case 'formador':
            return [...baseNav, { key: 'builder', label: 'Os meus cursos', short: 'Criar', href: '/formador/cursos', Icon: CreateCourseIcon, tag: 'Formador' }];
        case 'admin':
            return [...baseNav, requestsItem, teamsItem, { key: 'builder', label: 'Gerir cursos', short: 'Gerir', href: '/formador/cursos', Icon: CreateCourseIcon, tag: 'Admin' }];
        default:
            return baseNav;
    }
}

function Badge({ n, className = '' }) {
    if (!n) return null;
    return (
        <span className={`inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-live px-[5px] font-display text-[11px] font-bold leading-none tracking-normal text-white ${className}`}>
            {n > 99 ? '99+' : n}
        </span>
    );
}

// Sino do Gestor de Cursos/admin: pedidos novos
function Bell({ inbox }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
        if (!open) return;
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
                className="relative flex h-9 w-9 items-center justify-center"
            >
                <span className="ta-cut-8 absolute inset-0 bg-surface" aria-hidden="true" />
                <svg className="relative" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
                </svg>
                <Badge n={inbox.count} className="absolute -right-2 -top-[7px] shadow-[0_0_0_2px_var(--color-bg)]" />
            </button>
            {open && (
                <div className="ta-cut-12 absolute right-0 top-12 z-40 w-[320px] max-w-[calc(100vw-32px)] bg-surface shadow-[0_12px_40px_rgba(0,0,0,.15)]">
                    <p className="border-b border-line px-4 py-3 font-display text-sm font-bold">Pedidos novos</p>
                    {inbox.items.length ? inbox.items.map((r) => (
                        <Link key={r.id} href={`/gestao/pedidos?pedido=${r.id}`} onClick={() => setOpen(false)} className="block border-b border-line px-4 py-3 text-sm hover:bg-page">
                            <b>#{r.id}</b> · {r.kind}
                            <small className="block text-xs text-muted">{r.who} · {r.ago}</small>
                        </Link>
                    )) : <p className="px-4 py-6 text-center text-sm text-muted">Sem pedidos novos.</p>}
                    <Link href="/gestao/pedidos" onClick={() => setOpen(false)} className="block px-4 py-3 text-center font-display text-[13px] font-semibold text-accent-ink hover:text-ink">
                        Ver todos os pedidos →
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

export default function StudentLayout({ xp = null, children }) {
    const { auth, staffInbox } = usePage().props;
    const currentUrl = usePage().url;
    const user = auth?.user ?? {};
    const navItems = navFor(auth?.role);

    const isActive = (href) =>
        href !== '#' &&
        (currentUrl === href || currentUrl.startsWith(href + '/') || currentUrl.startsWith(href + '?'));

    return (
        <div className="min-h-screen bg-page text-ink">
            <header className="sticky top-0 z-30 border-b border-line bg-page">
                <div className="mx-auto flex h-[66px] max-w-[1400px] items-center gap-7 px-4 sm:px-7">
                    <Link href="/dashboard" className="flex shrink-0 items-center">
                        <Logo />
                    </Link>

                    <nav className="hidden gap-6 font-display text-[15px] font-semibold uppercase tracking-[0.04em] md:flex">
                        {navItems.map((item) => (
                            <Link
                                key={item.key}
                                href={item.href}
                                title={item.href === '#' ? 'Em breve' : undefined}
                                className={`inline-flex items-center gap-2 ${
                                    isActive(item.href)
                                        ? 'border-b-2 border-accent pb-1 text-accent-ink'
                                        : `border-b-2 border-transparent pb-1 transition-colors hover:text-ink ${item.tag ? 'text-ink' : 'text-muted'}`
                                }`}
                            >
                                {item.label}
                                {item.badge && <Badge n={staffInbox?.count} />}
                                {item.tag && (
                                    <span className="bg-ink px-1.5 py-0.5 font-mono text-[9.5px] font-semibold tracking-[0.08em] text-accent">
                                        {item.tag.toUpperCase()}
                                    </span>
                                )}
                            </Link>
                        ))}
                    </nav>

                    <div className="ml-auto flex items-center gap-3">
                        {xp !== null ? (
                            <div className="ta-cut-8 flex items-center gap-2 bg-surface px-3.5 py-[7px] font-display text-[15px] font-bold">
                                <span className="text-accent-ink">XP</span>
                                {formatXp(xp)}
                            </div>
                        ) : (
                            <div className="ta-cut-8 flex items-center gap-2 bg-surface px-3.5 py-[7px] font-display text-[15px] font-bold">
                                {user.streak_days ?? 0}
                                <span className="text-accent-ink">DIAS</span>
                            </div>
                        )}

                        {staffInbox && <Bell inbox={staffInbox} />}

                        <ThemeToggle />

                        <Dropdown>
                            <Dropdown.Trigger>
                                <button
                                    type="button"
                                    aria-label="Menu da conta"
                                    className="ta-cut-8 ta-press flex h-9 w-9 items-center justify-center bg-accent font-display text-[13px] font-bold text-on-accent"
                                >
                                    {initials(user.name) || 'AL'}
                                </button>
                            </Dropdown.Trigger>
                            <Dropdown.Content>
                                <div className="border-b border-line px-4 py-3">
                                    <p className="truncate font-display text-sm font-bold text-ink">
                                        {user.name ?? 'Aluno'}
                                    </p>
                                    <p className="truncate text-xs text-muted">{user.email}</p>
                                </div>
                                <Dropdown.Link href="/profile">Perfil</Dropdown.Link>
                                <Dropdown.Link href="/logout" method="post" as="button">
                                    Terminar sessão
                                </Dropdown.Link>
                            </Dropdown.Content>
                        </Dropdown>
                    </div>
                </div>
            </header>

            <main className="mx-auto w-full max-w-[1400px] px-4 pb-24 pt-6 sm:px-6 md:pb-10">{children}</main>

            {/* Bottom tab bar (mobile) — mesma navegação da topbar */}
            <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-line bg-surface px-2 py-1.5 md:hidden">
                {navItems.map(({ key, label, short, href, Icon, badge }) => (
                    <Link
                        key={key}
                        href={href}
                        aria-label={label}
                        className={`relative flex flex-col items-center gap-0.5 px-2 py-1 font-display text-[11px] font-semibold uppercase tracking-[0.04em] ${
                            isActive(href) ? 'text-accent-ink' : 'text-muted'
                        }`}
                    >
                        <Icon className="h-5 w-5" />
                        {badge && <Badge n={staffInbox?.count} className="absolute -top-1 right-0" />}
                        {short ?? label}
                    </Link>
                ))}
            </nav>
        </div>
    );
}
