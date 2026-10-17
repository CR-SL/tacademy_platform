import { Link, usePage } from '@inertiajs/react';
import Dropdown from '@/Components/Dropdown';
import Logo from '@/Components/Logo';
import ThemeToggle from '@/Components/ThemeToggle';
import { CatalogIcon, CreateCourseIcon, GoalsIcon, TeamIcon } from '@/Components/NavIcons';

// Navegação da topbar (direção 4b). '#' = secção ainda por construir.
const baseNav = [
    { key: 'tasks', label: 'Tarefas', href: '/dashboard', Icon: GoalsIcon },
    { key: 'courses', label: 'Cursos', href: '/plataforma/cursos', Icon: CatalogIcon },
    { key: 'team', label: 'Equipa', href: '#', Icon: TeamIcon },
];

// "Os meus cursos" só aparece a formadores e admins
function navFor(role) {
    if (role === 'formador') {
        return [...baseNav, { key: 'builder', label: 'Os meus cursos', short: 'Criar', href: '/formador/cursos', Icon: CreateCourseIcon, tag: 'Formador' }];
    }
    if (role === 'admin') {
        return [...baseNav, { key: 'builder', label: 'Gerir cursos', short: 'Gerir', href: '/formador/cursos', Icon: CreateCourseIcon, tag: 'Admin' }];
    }
    return baseNav;
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
    const { auth } = usePage().props;
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
                {navItems.map(({ key, label, short, href, Icon }) => (
                    <Link
                        key={key}
                        href={href}
                        aria-label={label}
                        className={`flex flex-col items-center gap-0.5 px-3 py-1 font-display text-[11px] font-semibold uppercase tracking-[0.04em] ${
                            isActive(href) ? 'text-accent-ink' : 'text-muted'
                        }`}
                    >
                        <Icon className="h-5 w-5" />
                        {short ?? label}
                    </Link>
                ))}
            </nav>
        </div>
    );
}
