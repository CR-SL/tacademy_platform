import { Head, Link, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import StudentLayout, { formatXp, initials } from '@/Layouts/StudentLayout';

// Dashboard "Centro de Tarefas" — Identidade Visual v3 · direção 4b (ver README.md).

const XP_PER_LEVEL = 400;
const ACCENT = 'var(--color-accent)';
const TRACK = 'var(--color-track)';

const TABS = [
    { key: 'daily', label: 'Diárias' },
    { key: 'weekly', label: 'Semanais' },
    { key: 'team', label: 'Equipa' },
];

const FEED_AGO = ['agora', '3 min', '6 min', '9 min', '12 min'];

// Barras e anéis animam de 0 até ao valor ao montar.
function useMounted() {
    const [ready, setReady] = useState(false);
    useEffect(() => {
        const t = setTimeout(() => setReady(true), 60);
        return () => clearTimeout(t);
    }, []);
    return ready;
}

function SectionLabel({ children, className = '' }) {
    return (
        <span className={`font-display text-[13px] font-bold uppercase tracking-[0.1em] ${className}`}>
            {children}
        </span>
    );
}

function ProfileCard({ name, xp, stats, ready }) {
    const level = Math.floor(xp / XP_PER_LEVEL) + 1;
    const inLevel = xp % XP_PER_LEVEL;
    const pct = Math.round((inLevel / XP_PER_LEVEL) * 100);
    const shown = ready ? pct : 0;

    return (
        <div className="ta-cut-16 flex flex-col items-center gap-3.5 bg-surface p-[22px] text-center">
            <div
                className="flex h-[108px] w-[108px] items-center justify-center rounded-full"
                style={{
                    background: `conic-gradient(${ACCENT} 0 ${shown}%, ${TRACK} 0 100%)`,
                    transition: 'background .6s',
                }}
            >
                <div className="flex h-[94px] w-[94px] items-center justify-center rounded-full bg-surface2 font-display text-[30px] font-bold text-ink">
                    {initials(name) || 'AL'}
                </div>
            </div>

            <div>
                <div className="font-display text-[13px] font-bold tracking-[0.1em] text-accent-ink">
                    NÍVEL {level}
                </div>
                <div className="mt-0.5 font-display text-[26px] font-bold leading-[1.1]">{name}</div>
                <div className="text-sm text-muted">Técnico de Diagnóstico</div>
            </div>

            <div className="flex w-full flex-col gap-1.5">
                <div className="ta-slant-4 h-2.5 bg-track">
                    <div className="ta-fill h-full bg-accent" style={{ width: `${shown}%` }} />
                </div>
                <div className="flex justify-between text-xs text-muted">
                    <span>
                        {inLevel} / {XP_PER_LEVEL} XP
                    </span>
                    <span>Nível {level + 1}</span>
                </div>
            </div>

            <div className="grid w-full grid-cols-3 gap-1.5 border-t border-line pt-3.5">
                {[
                    [stats.lessons, 'AULAS'],
                    [`${stats.hours}h`, 'ESTUDO'],
                    [stats.certificates, 'CERTIF.'],
                ].map(([value, label]) => (
                    <div key={label}>
                        <div className="font-display text-[22px] font-bold">{value}</div>
                        <div className="text-[11px] text-muted">{label}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function ContinueCard({ course }) {
    if (!course) {
        return (
            <div className="ta-cut-16 flex flex-col gap-3 bg-accent p-5 text-on-accent">
                <span className="font-display text-xs font-bold tracking-[0.1em]">COMEÇAR</span>
                <span className="font-display text-[22px] font-bold leading-[1.1]">
                    Ainda não começaste nenhum curso
                </span>
                <Link
                    href="/cursos"
                    className="ta-cut-8 ta-press self-start bg-on-accent px-4 py-[9px] font-display text-sm font-bold text-accent"
                >
                    VER CURSOS ▶
                </Link>
            </div>
        );
    }

    const segment = { done: '#18181b', current: '#18181b70', todo: '#18181b25' };

    return (
        <div className="ta-cut-16 flex flex-col gap-3 bg-accent p-5 text-on-accent">
            <span className="font-display text-xs font-bold tracking-[0.1em]">
                CONTINUAR{course.has_ai ? ' · AULA COM IA' : ''}
            </span>
            <span className="font-display text-[22px] font-bold leading-[1.1]">{course.title}</span>
            {course.modules.length > 0 && (
                <div
                    className="grid gap-1"
                    style={{ gridTemplateColumns: `repeat(${course.modules.length}, minmax(0, 1fr))` }}
                >
                    {course.modules.map((state, i) => (
                        <div
                            key={i}
                            className="h-2"
                            style={{ background: segment[state], transform: 'skewX(-20deg)' }}
                        />
                    ))}
                </div>
            )}
            <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] font-semibold">
                    Módulo {course.current_module} de {course.modules.length || 1}
                </span>
                <Link
                    href={course.url}
                    className="ta-cut-8 ta-press bg-on-accent px-4 py-[9px] font-display text-sm font-bold text-accent"
                >
                    RETOMAR ▶
                </Link>
            </div>
        </div>
    );
}

function MissionRow({ mission, index, ready, onClaim }) {
    const complete = mission.progress >= mission.target;
    const claimed = mission.claimed;
    const claimable = complete && !claimed;
    const pct = Math.min(100, (mission.progress / mission.target) * 100);

    const button = claimed
        ? { label: 'RECOLHIDO ✓', cls: 'border border-line bg-transparent text-muted cursor-default' }
        : complete
          ? { label: 'RECOLHER', cls: 'border border-transparent bg-accent text-on-accent cursor-pointer' }
          : { label: 'EM CURSO', cls: 'border border-transparent bg-surface2 text-muted cursor-default' };

    return (
        <div
            className="ta-cut-12 grid grid-cols-[44px_minmax(0,1fr)] items-center gap-4 bg-surface px-5 py-[18px] sm:grid-cols-[44px_minmax(0,1fr)_150px]"
            style={{
                boxShadow: claimable ? `inset 0 0 0 2px ${ACCENT}` : 'none',
                transition: 'box-shadow .3s',
            }}
        >
            <div
                className={`ta-cut-8 flex h-11 w-11 items-center justify-center font-display text-lg font-bold transition-colors duration-300 ${
                    complete ? 'bg-accent text-on-accent' : 'bg-surface2 text-muted'
                }`}
            >
                {claimed ? '✓' : complete ? '!' : index + 1}
            </div>

            <div className="flex min-w-0 flex-col gap-2">
                <div className="flex items-baseline justify-between gap-2.5">
                    <span className="text-base font-semibold">{mission.title}</span>
                    <span className="whitespace-nowrap font-display text-sm font-bold text-accent-ink">
                        +{mission.reward_xp} XP
                    </span>
                </div>
                <div className="flex items-center gap-2.5">
                    <div className="h-2 flex-1 bg-track">
                        <div className="ta-fill h-full bg-accent" style={{ width: `${ready ? pct : 0}%` }} />
                    </div>
                    <span className="font-display text-[13px] font-semibold text-muted">
                        {mission.progress}/{mission.target}
                    </span>
                </div>
            </div>

            <button
                type="button"
                onClick={() => claimable && onClaim(mission)}
                disabled={!claimable}
                className={`ta-press col-span-2 py-[11px] text-center font-display text-sm font-bold tracking-[0.04em] sm:col-span-1 ${button.cls}`}
            >
                {button.label}
            </button>
        </div>
    );
}

function TeamChallenge({ challenge, ready }) {
    const pct = Math.round((challenge.done / challenge.target) * 100);
    const left = challenge.target - challenge.done;

    return (
        <div className="ta-cut-12 flex items-center gap-5 bg-surface p-5">
            <div
                className="flex h-[84px] w-[84px] shrink-0 items-center justify-center rounded-full"
                style={{
                    background: `conic-gradient(${ACCENT} 0 ${ready ? pct : 0}%, ${TRACK} 0 100%)`,
                    transition: 'background .6s',
                }}
            >
                <div className="flex h-[66px] w-[66px] items-center justify-center rounded-full bg-surface font-display text-lg font-bold">
                    {pct}%
                </div>
            </div>
            <div className="flex flex-1 flex-col gap-1">
                <span className="font-display text-xs font-bold uppercase tracking-[0.1em] text-muted">
                    Desafio de equipa · {challenge.team}
                </span>
                <span className="text-lg font-semibold">
                    {challenge.done} de {challenge.target} aulas concluídas esta semana
                </span>
                <span className="text-sm text-muted">
                    {left > 0
                        ? `Faltam ${left} aulas. Se conseguirem, toda a equipa ganha +${challenge.reward_xp} XP.`
                        : `Desafio cumprido! Toda a equipa ganha +${challenge.reward_xp} XP.`}
                </span>
            </div>
        </div>
    );
}

// Feed ao vivo: na produção deve vir de websocket ou polling; aqui roda os eventos a cada 3s.
function LiveFeed({ events }) {
    const [offset, setOffset] = useState(0);

    useEffect(() => {
        if (events.length < 2) return;
        const iv = setInterval(() => setOffset((o) => o + 1), 3000);
        return () => clearInterval(iv);
    }, [events.length]);

    const n = events.length;
    const rows = Array.from({ length: Math.min(5, n) }, (_, i) => ({
        ...events[(((offset - i) % n) + n) % n],
        key: offset - i,
        ago: FEED_AGO[i],
        opacity: 1 - i * 0.14,
    }));

    return (
        <div className="ta-cut-16 flex flex-col gap-1 bg-surface p-5">
            <div className="mb-2 flex items-center gap-2">
                <span className="ta-live-dot inline-block h-2 w-2 rounded-full bg-live" />
                <SectionLabel>Ao vivo na equipa</SectionLabel>
            </div>
            {rows.map((row, i) => (
                <div
                    key={row.key}
                    className={`grid grid-cols-[32px_minmax(0,1fr)] gap-2.5 border-t border-line py-[9px] ${i === 0 ? 'ta-slide-in' : ''}`}
                    style={{ opacity: row.opacity, transition: 'opacity .3s' }}
                >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface2 text-xs font-semibold">
                        {initials(row.name)}
                    </div>
                    <div className="flex flex-col gap-0.5">
                        <span className="text-sm leading-[1.3]">
                            <span className="font-semibold">{row.name}</span> {row.action}
                        </span>
                        <span className="text-xs text-muted">{row.ago}</span>
                    </div>
                </div>
            ))}
        </div>
    );
}

function Leaderboard({ rows }) {
    return (
        <div className="ta-cut-16 flex flex-col gap-1 bg-surface p-5">
            <SectionLabel className="mb-2">Classificação semanal</SectionLabel>
            {rows.map((row, i) => (
                <div
                    key={row.name + i}
                    className={`grid grid-cols-[28px_1fr_auto] items-center gap-2.5 px-2.5 py-2 transition-colors duration-300 ${
                        row.me ? 'bg-accent text-on-accent' : 'text-ink'
                    }`}
                >
                    <span className="font-display text-base font-bold">{i + 1}</span>
                    <span className="truncate text-sm font-medium">
                        {row.name}
                        {row.me ? ' (tu)' : ''}
                    </span>
                    <span className="font-display text-sm font-bold">{formatXp(row.xp)}</span>
                </div>
            ))}
        </div>
    );
}

export default function Dashboard({
    stats,
    continueCourse,
    xp: initialXp,
    missions: initialMissions,
    teamChallenge,
    feed,
    leaderboard,
}) {
    const { auth } = usePage().props;
    const name = auth?.user?.name ?? 'Aluno';
    const ready = useMounted();

    const [xp, setXp] = useState(initialXp);
    const [missions, setMissions] = useState(initialMissions);
    const [tab, setTab] = useState('daily');
    const [toast, setToast] = useState(null);
    const toastTimer = useRef(null);

    useEffect(() => () => clearTimeout(toastTimer.current), []);

    // Recolher: atualização otimista (XP, nível, anel, barra, classificação).
    // TODO: quando existir a API, chamar POST /missions/:id/claim e acertar com o XP devolvido.
    const claim = (mission) => {
        setMissions((all) => ({
            ...all,
            [tab]: all[tab].map((m) => (m.id === mission.id ? { ...m, claimed: true } : m)),
        }));
        setXp((v) => v + mission.reward_xp);
        setToast({ id: Date.now(), xp: mission.reward_xp });
        clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(null), 2200);
    };

    const board = useMemo(
        () =>
            leaderboard
                .map((row) => (row.me ? { ...row, xp } : row))
                .sort((a, b) => b.xp - a.xp),
        [leaderboard, xp],
    );

    const pending = (key) => missions[key].filter((m) => m.progress >= m.target && !m.claimed).length;

    return (
        <StudentLayout xp={xp}>
            <Head title="Tarefas" />

            {toast && (
                <div
                    key={toast.id}
                    role="status"
                    className="ta-cut-10 ta-toast fixed left-1/2 top-20 z-40 -ml-[110px] w-[220px] bg-accent py-3 text-center font-display text-lg font-bold text-on-accent shadow-[0_10px_30px_rgba(0,0,0,.2)]"
                >
                    +{toast.xp} XP RECOLHIDOS
                </div>
            )}

            <div className="grid gap-[18px] lg:grid-cols-[290px_minmax(0,1fr)_290px]">
                {/* Coluna esquerda: perfil + continuar */}
                <div className="flex flex-col gap-[18px]">
                    <ProfileCard name={name} xp={xp} stats={stats} ready={ready} />
                    <ContinueCard course={continueCourse} />
                </div>

                {/* Coluna central: tarefas + desafio de equipa */}
                <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <h1 className="font-display text-[26px] font-bold">TAREFAS</h1>
                        <div className="ta-cut-8 flex gap-1 bg-surface p-1" role="tablist">
                            {TABS.map(({ key, label }) => {
                                const n = pending(key);
                                const active = tab === key;
                                return (
                                    <button
                                        key={key}
                                        type="button"
                                        role="tab"
                                        aria-selected={active}
                                        onClick={() => setTab(key)}
                                        className={`flex items-center gap-2 px-4 py-2 font-display text-sm font-semibold transition-colors duration-200 ${
                                            active ? 'bg-ink text-page' : 'bg-transparent text-muted hover:text-ink'
                                        }`}
                                    >
                                        {label}
                                        {n > 0 && (
                                            <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent text-[11px] font-bold text-on-accent">
                                                {n}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {missions[tab].map((mission, i) => (
                        <MissionRow key={mission.id} mission={mission} index={i} ready={ready} onClaim={claim} />
                    ))}

                    <TeamChallenge challenge={teamChallenge} ready={ready} />
                </div>

                {/* Coluna direita: feed ao vivo + classificação */}
                <div className="flex flex-col gap-[18px]">
                    <LiveFeed events={feed} />
                    <Leaderboard rows={board} />
                </div>
            </div>
        </StudentLayout>
    );
}
