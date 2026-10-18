// Peças comuns às páginas de equipas e pedidos (mesmo visual do resto da plataforma).
import { usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';

export const inputCls =
    'w-full border border-line bg-page px-3 py-2.5 text-[15px] text-ink placeholder:text-muted/70 focus:border-accent focus:bg-surface focus:outline-none focus:ring-[3px] focus:ring-accent/20';

export const btn = {
    accent: 'ta-cut-8 ta-press bg-accent px-5 py-3 font-display text-sm font-bold uppercase tracking-[0.04em] text-on-accent disabled:cursor-not-allowed disabled:opacity-45',
    dark: 'ta-cut-8 ta-press bg-ink px-5 py-3 font-display text-sm font-bold uppercase tracking-[0.04em] text-accent disabled:opacity-45',
    line: 'ta-cut-8 ta-press bg-surface px-4 py-3 font-display text-sm font-bold uppercase tracking-[0.04em] shadow-[inset_0_0_0_1px_var(--color-line)] hover:bg-page',
    small: 'bg-surface2 px-3 py-2 font-display text-xs font-bold uppercase tracking-[0.04em] hover:bg-track',
};

export function PageHead({ over, title, sub, children }) {
    return (
        <div className="mb-6 flex flex-wrap items-end justify-between gap-5">
            <div>
                {over}
                <h1 className="mt-1.5 font-display text-[clamp(28px,3.2vw,42px)] font-bold leading-none tracking-[-0.01em]">{title}</h1>
                {sub && <p className="mt-2 text-muted">{sub}</p>}
            </div>
            {children && <div className="flex flex-wrap gap-2.5">{children}</div>}
        </div>
    );
}

export const Over = ({ children }) => <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted">{children}</p>;

export function Kpi({ label, value, hint, bar, alert }) {
    return (
        <div className="ta-cut-12 bg-surface px-5 py-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted">{label}</p>
            <p className={`mt-0.5 font-display text-[28px] font-bold ${alert ? 'text-live' : ''}`}>{value}</p>
            {bar !== undefined && (
                <div className="mt-2 h-1.5 bg-track"><div className="h-full bg-accent" style={{ width: `${Math.min(100, bar)}%` }} /></div>
            )}
            {hint && <p className="mt-1 text-[12.5px] text-muted">{hint}</p>}
        </div>
    );
}

export function Progress({ value }) {
    return (
        <div className="flex min-w-[130px] items-center gap-2">
            <span className="h-1.5 flex-1 bg-track"><span className="block h-full bg-accent" style={{ width: `${value}%` }} /></span>
            <b className="min-w-[36px] text-right font-display text-[13px]">{value}%</b>
        </div>
    );
}

const chipTones = {
    ok: 'bg-[#2F9E5B1c] text-[#2F9E5B]',
    warn: 'bg-accent/15 text-accent-ink',
    bad: 'bg-live/10 text-live',
    info: 'bg-[#3A6FD81a] text-[#3A6FD8]',
    dark: 'bg-ink text-accent',
    mut: 'bg-surface2 text-muted',
};
export function Chip({ tone = 'mut', children }) {
    return <span className={`inline-flex items-center gap-1 whitespace-nowrap px-2 py-[3px] font-mono text-[11px] font-semibold uppercase tracking-[0.06em] ${chipTones[tone]}`}>{children}</span>;
}

export function Tabs({ items, value, onChange, label }) {
    return (
        <div role="group" aria-label={label} className="ta-cut-8 mb-4 inline-flex flex-wrap gap-[3px] bg-surface2 p-[3px]">
            {items.map(([v, text, count]) => (
                <button
                    key={v}
                    type="button"
                    aria-pressed={value === v}
                    onClick={() => onChange(v)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 font-display text-[13.5px] font-semibold ${value === v ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'}`}
                >
                    {text}
                    {count !== undefined && <em className="font-mono text-[11px] not-italic opacity-70">{count}</em>}
                </button>
            ))}
        </div>
    );
}

/** Painel lateral (pedido, equipa, pedido de alteração). */
export function Drawer({ over, title, onClose, footer, width = 'w-[min(640px,100%)]', children }) {
    useEffect(() => {
        const esc = (e) => e.key === 'Escape' && onClose();
        document.addEventListener('keydown', esc);
        document.body.style.overflow = 'hidden';
        return () => { document.removeEventListener('keydown', esc); document.body.style.overflow = ''; };
    }, [onClose]);

    return (
        <>
            <div className="fixed inset-0 z-40 bg-ink/35" onClick={onClose} aria-hidden="true" />
            <aside role="dialog" aria-modal="true" aria-label={title} className={`fixed inset-y-0 right-0 z-50 flex ${width} flex-col bg-page shadow-[-20px_0_60px_rgba(0,0,0,.15)]`}>
                <div className="flex items-start gap-4 border-b border-line bg-surface px-6 pb-4 pt-5">
                    <div className="min-w-0">
                        <Over>{over}</Over>
                        <h2 className="mt-1 font-display text-2xl font-bold leading-tight">{title}</h2>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Fechar" className="ml-auto h-9 w-9 flex-none bg-surface2 hover:bg-track">✕</button>
                </div>
                <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-6 py-5">{children}</div>
                {footer && <div className="flex flex-wrap items-center gap-2.5 border-t border-line bg-surface px-6 py-3.5">{footer}</div>}
            </aside>
        </>
    );
}

export function Box({ title, right, children }) {
    return (
        <section className="ta-cut-12 bg-surface px-5 py-4">
            {title && (
                <h3 className="mb-2.5 flex items-center justify-between font-display text-sm font-bold uppercase tracking-[0.04em]">
                    {title}
                    {right}
                </h3>
            )}
            {children}
        </section>
    );
}

/** Mensagem de sucesso que vem do servidor (flash.status). */
export function FlashToast() {
    const { flash } = usePage().props;
    const [msg, setMsg] = useState(null);
    useEffect(() => {
        if (!flash?.status) return;
        setMsg(flash.status);
        const t = setTimeout(() => setMsg(null), 4500);
        return () => clearTimeout(t);
    }, [flash]);
    if (!msg) return null;
    return (
        <div role="status" className="ta-cut-8 fixed bottom-20 left-1/2 z-[60] -translate-x-1/2 bg-ink px-5 py-3 font-display text-sm font-semibold text-white md:bottom-6">
            <span className="text-accent">✓</span> {msg}
        </div>
    );
}

export const Th = ({ children, className = '' }) => (
    <th className={`whitespace-nowrap border-b border-line px-3 py-2.5 text-left font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted ${className}`}>{children}</th>
);
export const Td = ({ children, className = '' }) => <td className={`border-b border-line px-3 py-3 align-middle ${className}`}>{children}</td>;
