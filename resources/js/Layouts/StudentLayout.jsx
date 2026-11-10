import { Link, usePage } from '@inertiajs/react';
import Dropdown from '@/Components/Dropdown';
import { Toast } from '@/Components/ui';
import { useEffect, useRef, useState } from 'react';
import useTheme from '@/hooks/useTheme';
import {
    IconAdmin, IconBook, IconCatalog, IconCert, IconCreate, IconDoc, IconHome, IconInbox, IconMoon, IconSun, IconTeam, IconTest, IconUser,
} from '@/Components/Panels/icons';

import { t } from '@/i18n';
import LanguageToggle from '@/Components/LanguageToggle';

// Navegação da plataforma (a aparência decidida a 2026-11-04): logótipo e opções à esquerda.
const baseNav = () => [
    { key: 'home', label: t('Início'), href: '/dashboard', Icon: IconHome, count: 'home', countLabel: [t('mensagem por ler'), t('mensagens por ler')] },
    { key: 'catalog', label: t('Catálogo'), href: '/plataforma/cursos', Icon: IconCatalog, exact: true },
    { key: 'mine', label: t('Os meus cursos'), short: t('Cursos'), href: '/plataforma/meus-cursos', Icon: IconBook, count: 'mine', countLabel: [t('curso atribuído por começar'), t('cursos atribuídos por começar')] },
    { key: 'docs', label: t('Documentos'), href: '/plataforma/documentos', Icon: IconDoc },
    { key: 'tests', label: t('Avaliações'), href: '/plataforma/avaliacoes', Icon: IconTest },
    { key: 'certs', label: t('Certificados'), href: '/plataforma/certificados', Icon: IconCert },
];
const requestsItem = () => ({ key: 'requests', label: t('Pedidos'), href: '/gestao/pedidos', Icon: IconInbox, badge: true });
const teamsItem = () => ({ key: 'teams', label: t('Equipas'), href: '/gestao/equipas', Icon: IconTeam });

const builderCount = [t('presença por confirmar'), t('presenças por confirmar')];

// Formador, gestor de cursos e admin: só o seu trabalho, sem a parte do aluno (opção D, 2026-11-09)
function workNav(can = {}) {
    const items = [];
    if (can.estatisticas || can.pessoas) items.push({ key: 'admin', label: t('Administração'), short: t('Admin'), href: '/administracao', Icon: IconAdmin });
    if (can['cursos.criar'] && !can['cursos.todos']) {
        items.push(
            { key: 'f-home', label: t('Início'), href: '/formador', exact: true, Icon: IconHome, count: 'home', countLabel: [t('mensagem por ler'), t('mensagens por ler')] },
            { key: 'builder', label: t('Os meus cursos'), short: t('Cursos'), href: '/formador/cursos', Icon: IconBook, count: 'builder', countLabel: builderCount },
            { key: 'f-tests', label: t('Avaliações'), href: '/formador/avaliacoes', Icon: IconTest, count: 'ftests', countLabel: [t('aluno ainda não passou'), t('alunos ainda não passaram')] },
        );
    }
    if (can.pedidos) items.push(requestsItem());
    if (can.equipas) items.push(teamsItem());
    if (can['cursos.todos']) items.push({ key: 'builder', label: t('Gerir cursos'), short: t('Cursos'), href: '/formador/cursos', Icon: IconCreate, count: 'builder', countLabel: builderCount });
    return items;
}

// Cada pessoa vê as opções das permissões do seu perfil (Administração › Permissões)
function navFor(can = {}, role, worksOnly = false) {
    // Sem nenhuma opção de trabalho (permissões retiradas), volta à barra do aluno
    const work = worksOnly ? workNav(can) : [];
    if (work.length) return work;
    const items = [...baseNav()];
    // Equipa do team leader (a da sua empresa); quem gere todas as equipas usa a da gestão
    if (can.equipa && !can.equipas) items.push({ key: 'team', label: t('Equipas'), href: '/equipa', Icon: IconTeam, count: 'team', countLabel: [t('pessoa precisa de atenção'), t('pessoas precisam de atenção')] });
    if (can.pedidos) items.push(requestsItem());
    if (can.equipas) items.push(teamsItem());
    if (can['cursos.todos']) items.push({ key: 'builder', label: t('Gerir cursos'), short: t('Gerir'), href: '/formador/cursos', Icon: IconCreate, tag: role === 'admin' ? t('Admin') : undefined, count: 'builder', countLabel: [t('presença por confirmar'), t('presenças por confirmar')] });
    else if (can['cursos.criar']) items.push({ key: 'builder', label: t('Criar cursos'), short: t('Criar'), href: '/formador/cursos', Icon: IconCreate, tag: t('Formador'), count: 'builder', countLabel: [t('presença por confirmar'), t('presenças por confirmar')] });
    if (can.estatisticas || can.pessoas) items.push({ key: 'admin', label: t('Administração'), short: t('Admin'), href: '/administracao', Icon: IconAdmin });
    return items;
}

// Número amarelo na navegação, com o significado escondido para leitores de ecrã ("3 mensagens por ler")
function Count({ n, label }) {
    if (!n) return null;
    return (
        <span className="pn-count">
            {n > 99 ? '99+' : n}
            {label && <span className="pn-sr"> {n === 1 ? label[0] : label[1]}</span>}
        </span>
    );
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
                aria-label={t('Notificações:v1', { v1: inbox.count ? t(': :count pedidos novos', { count: inbox.count }) : '' })}
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
                    <p className="border-b border-line px-4 py-3 text-sm font-bold">{t('Pedidos novos')}</p>
                    {inbox.items.length ? inbox.items.map((r) => (
                        <Link key={r.id} href={`/gestao/pedidos?pedido=${r.id}`} onClick={() => setOpen(false)} className="block border-b border-line px-4 py-3 text-sm hover:bg-page">
                            <b>#{r.id}</b> · {r.kind}
                            <small className="block text-xs text-muted">{r.who} · {r.ago}</small>
                        </Link>
                    )) : <p className="px-4 py-6 text-center text-sm text-muted">{t('Sem pedidos novos.')}</p>}
                    <Link href="/gestao/pedidos" onClick={() => setOpen(false)} className="block px-4 py-3 text-center text-[13px] font-semibold underline underline-offset-4">
                        {t('Ver todos os pedidos')}
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
    const { auth, staffInbox, access, navCounts, can } = usePage().props;
    const currentUrl = usePage().url;
    const user = auth?.user ?? {};
    const navItems = navFor(can, auth?.role, auth?.worksOnly);
    const { theme, toggle } = useTheme();
    const dark = theme === 'dark';
    const [notice, setNotice] = useState(null);
    const noticeTimer = useRef(null);
    useEffect(() => () => clearTimeout(noticeTimer.current), []);


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
                <Link href={auth?.home ?? '/dashboard'} className="pn-logo" aria-label={t('T.Academy, início')}>
                    <img className="ta-logo-light" src="/images/brand/logo-nav.png" alt="T.Academy" />
                    <img className="ta-logo-dark" src="/images/brand/logo-nav-dark.png" alt="" />
                </Link>
                <nav className="pn-nav-links" aria-label={t('Principal')}>
                    {navItems.map((item) => (
                        <Link key={item.key} href={item.href} className={active(item) ? 'pn-on' : undefined} aria-current={active(item) ? 'page' : undefined}>
                            {item.label}
                            {item.badge && <Count n={staffInbox?.count} label={[t('pedido novo'), t('pedidos novos')]} />}
                            {item.count && <Count n={navCounts?.[item.count]} label={item.countLabel} />}
                            {item.tag && <span className="pn-tag">{item.tag}</span>}
                        </Link>
                    ))}
                </nav>
                <div className="pn-nav-end">
                    {navTools}
                    {staffInbox && <Bell inbox={staffInbox} />}
                    <LanguageToggle />
                    <button type="button" className="pn-icon" onClick={toggle} aria-label={dark ? t('Mudar para tema claro') : t('Mudar para tema escuro')} title={dark ? t('Tema claro') : t('Tema escuro')}>
                        {dark ? <IconSun /> : <IconMoon />}
                    </button>
                    <Dropdown>
                        <Dropdown.Trigger>
                            <button type="button" aria-label={t('Menu da conta')} className="pn-account"><IconUser /></button>
                        </Dropdown.Trigger>
                        <Dropdown.Content>
                            <div className="border-b border-line px-4 py-3">
                                <p className="truncate text-sm font-bold text-ink">{user.name ?? t('Aluno')}</p>
                                <p className="truncate text-xs text-muted">{user.email}</p>
                            </div>
                            <Dropdown.Link href="/definicoes">{t('Definições')}</Dropdown.Link>
                            <Dropdown.Link href="/logout" method="post" as="button">{t('Terminar sessão')}</Dropdown.Link>
                        </Dropdown.Content>
                    </Dropdown>
                </div>
            </header>

            <main className="pn-main">{children}</main>

            {/* Barra de baixo (janelas estreitas): mesma navegação da barra de cima */}
            <nav className="pn-tabbar" aria-label={t('Principal')}>
                {navItems.map((item) => {
                    const { key, label, short, href, Icon, badge, count, countLabel } = item;
                    return (
                        <Link key={key} href={href} aria-label={label} className={active(item) ? 'pn-on' : undefined} aria-current={active(item) ? 'page' : undefined}>
                            <Icon />
                            {badge && <Count n={staffInbox?.count} label={[t('pedido novo'), t('pedidos novos')]} />}
                            {count && <Count n={navCounts?.[count]} label={countLabel} />}
                            {short ?? label}
                        </Link>
                    );
                })}
            </nav>

            <Toast message={notice} />
        </div>
    );
}
