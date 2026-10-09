import { Link, usePage } from '@inertiajs/react';
import Dropdown from '@/Components/Dropdown';
import {
    HomeIcon,
    CatalogIcon,
    ExploreIcon,
    AchievementsIcon,
    GoalsIcon,
    TeamIcon,
} from '@/Components/NavIcons';

const navItems = [
    { key: 'dashboard', label: 'Início', href: '/dashboard', Icon: HomeIcon },
    { key: 'catalog', label: 'Catálogo', href: '/cursos', Icon: CatalogIcon },
    { key: 'explore', label: 'Explorar', href: '#', Icon: ExploreIcon },
    { key: 'achievements', label: 'Conquistas', href: '#', Icon: AchievementsIcon },
    { key: 'goals', label: 'Objetivos', href: '#', Icon: GoalsIcon },
    { key: 'team', label: 'Equipa', href: '#', Icon: TeamIcon },
];

function initials(name = '') {
    return name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((n) => n[0])
        .join('')
        .toUpperCase();
}

function NavButton({ item, active }) {
    const { Icon, href, label } = item;
    const classes = [
        'flex h-[38px] w-[38px] items-center justify-center rounded-[11px] transition-colors',
        active
            ? 'bg-[#EAF1FE] text-tblue shadow-[0_6px_16px_rgba(47,111,237,0.18)] ring-1 ring-[rgba(47,111,237,0.15)]'
            : 'text-brand-yellow hover:bg-[#EAF1FE] hover:text-tblue',
    ].join(' ');

    return (
        <Link href={href} title={label} aria-label={label} className={classes}>
            <Icon className="h-[19px] w-[19px]" />
        </Link>
    );
}

export default function StudentLayout({ children }) {
    const { auth } = usePage().props;
    const currentUrl = usePage().url;
    const user = auth?.user ?? {};

    const isActive = (href) => href !== '#' && (currentUrl === href || currentUrl.startsWith(href + '/'));

    return (
        <div className="relative min-h-screen bg-pearl text-ink">
            {/* Fundo com aurora subtil */}
            <div className="pointer-events-none fixed inset-0 z-0">
                <div className="ta-aurora" />
            </div>

            {/* Topo fixo e leve (vidro) */}
            <header className="sticky top-0 z-20 border-b border-white/70 bg-white/60 backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
                    <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
                        <img src="/images/passarinho.png" alt="T.Academy" className="h-6 w-auto" />
                        <span className="text-sm font-bold sm:text-base">
                            T.Academy <span className="text-tblue">Platform</span>
                        </span>
                    </Link>

                    <label className="relative hidden flex-1 max-w-xs sm:block">
                        <input
                            type="search"
                            placeholder="Procurar cursos"
                            className="w-full rounded-full border border-white/80 bg-white/70 px-4 py-2 text-xs text-steel backdrop-blur placeholder:text-steel focus:outline-none focus:ring-2 focus:ring-[rgba(47,111,237,0.3)]"
                        />
                    </label>

                    <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1.5 rounded-full border border-[#E8940F]/30 bg-[#FDF0DE] px-2.5 py-1.5">
                            <span className="text-xs">🔥</span>
                            <span className="text-xs font-bold text-[#B4650C]">
                                {user.streak_days ?? 0} dias
                            </span>
                        </span>
                        <Dropdown>
                            <Dropdown.Trigger>
                                <button
                                    type="button"
                                    aria-label="Menu da conta"
                                    className="flex h-8 w-8 items-center justify-center rounded-full bg-mist text-xs font-bold text-steel transition hover:ring-2 hover:ring-[rgba(47,111,237,0.3)]"
                                >
                                    {initials(user.name) || 'AL'}
                                </button>
                            </Dropdown.Trigger>
                            <Dropdown.Content>
                                <div className="border-b border-mist px-4 py-3">
                                    <p className="truncate text-sm font-semibold text-ink">
                                        {user.name ?? 'Aluno'}
                                    </p>
                                    <p className="truncate text-xs text-steel">{user.email}</p>
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

            <div className="relative z-10 flex">
                {/* Sidebar de ícones (desktop) */}
                <aside className="sticky top-[57px] hidden h-[calc(100vh-57px)] w-[64px] flex-col items-center gap-4 border-r border-white/60 bg-white/30 py-5 backdrop-blur-sm sm:flex">
                    {navItems.map((item) => (
                        <NavButton key={item.key} item={item} active={isActive(item.href)} />
                    ))}
                </aside>

                {/* Conteúdo */}
                <main className="flex-1 px-4 pb-24 pt-6 sm:px-8 sm:pb-10 lg:px-10">
                    <div className="mx-auto w-full max-w-[1600px]">{children}</div>
                </main>
            </div>

            {/* Bottom tab bar (mobile) */}
            <nav className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-around border-t border-white/70 bg-white/80 px-2 py-2 backdrop-blur-xl sm:hidden">
                {navItems.slice(0, 5).map((item) => (
                    <NavButton key={item.key} item={item} active={isActive(item.href)} />
                ))}
            </nav>
        </div>
    );
}
