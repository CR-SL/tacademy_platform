// Componentes base da plataforma (DESIGN.md › Components). Estilos em resources/css/ui.css.
// Guia de uso de cada um: public/landing-concepts/componentes.html.
import { Link, usePage } from '@inertiajs/react';
import { Children, cloneElement, isValidElement, useCallback, useEffect, useRef, useState } from 'react';
import Modal from '@/Components/Modal';

import { t } from '@/i18n';

const VARIANTS = { primary: '', accent: 'ui-btn-accent', soft: 'ui-btn-soft', line: 'ui-btn-line', danger: 'ui-btn-danger', glass: 'ui-btn-glass' };
const SIZES = { md: '', sm: 'ui-btn-sm', lg: 'ui-btn-lg' };

/** Classes de um botão: btnClass('accent', 'sm'). Para quando o elemento não é um <Button>. */
export const btnClass = (variant = 'primary', size = 'md', extra = '') =>
    ['ui-btn', VARIANTS[variant], SIZES[size], extra].filter(Boolean).join(' ');

/** Atalhos com os nomes antigos de Teams/ui (btn.accent, btn.dark, btn.line, btn.small). */
export const btn = {
    accent: btnClass('accent'),
    dark: btnClass('primary'),
    line: btnClass('line'),
    soft: btnClass('soft'),
    small: btnClass('soft', 'sm'),
};

export const inputCls = 'ui-input';

/**
 * Botão em cápsula. Com href vira ligação Inertia (ou <a> com external).
 * <Button variant="accent" size="sm" block>Entrar</Button>
 */
export function Button({ variant = 'primary', size = 'md', block = false, href, external = false, className = '', type = 'button', children, ...props }) {
    const cls = btnClass(variant, size, [block && 'ui-btn-block', className].filter(Boolean).join(' '));
    if (href && external) return <a href={href} className={cls} {...props}>{children}</a>;
    if (href) return <Link href={href} className={cls} {...props}>{children}</Link>;
    return <button type={type} className={cls} {...props}>{children}</button>;
}

/** Ícone de fechar desenhado (em vez do carácter ✕). */
export const IconClose = (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" {...props}><path d="M7 7l10 10M17 7 7 17" /></svg>
);

/**
 * Campo com etiqueta, ajuda e erro. Liga sozinho a ajuda/erro ao campo (aria-describedby, aria-invalid)
 * quando o filho é um único elemento com o mesmo id.
 */
export function Field({ id, label, hint, error, children, className = '' }) {
    const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
    const child = Children.only(children);
    const input = isValidElement(child) && child.props.id === id
        ? cloneElement(child, {
            'aria-describedby': child.props['aria-describedby'] ?? describedBy,
            'aria-invalid': child.props['aria-invalid'] ?? (error ? true : undefined),
        })
        : child;
    return (
        <div className={`flex flex-col gap-1.5 ${className}`}>
            {label && <label htmlFor={id} className="ui-label">{label}</label>}
            {input}
            {hint && !error && <span id={`${id}-hint`} className="ui-hint">{hint}</span>}
            {error && <span id={`${id}-err`} className="ui-err">{error}</span>}
        </div>
    );
}

/* ---------- Estado ---------- */

const chipTones = {
    ok: 'ui-chip-ok',
    warn: 'ui-chip-warn',
    bad: 'ui-chip-bad',
    info: 'ui-chip-info',
    dark: 'ui-chip-dark',
    mut: '',
};
/** Etiqueta de estado em cápsula: <Chip tone="ok">Concluído</Chip> (ok · warn · bad · info · dark · mut). */
export function Chip({ tone = 'mut', children }) {
    return <span className={`ui-chip ${chipTones[tone] ?? ''}`}>{children}</span>;
}

/** Barra de progresso (o número fica escrito ao lado ou por baixo, por isso a barra é escondida aos leitores de ecrã). */
export function Bar({ value, className = '' }) {
    return <span className={`ui-bar ${className}`} aria-hidden="true"><i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></span>;
}

/** Barra com a percentagem ao lado (tabelas da gestão). */
export function Progress({ value }) {
    return (
        <div className="flex min-w-[130px] items-center gap-2">
            <Bar value={value} className="flex-1" />
            <b className="min-w-[36px] text-right font-display text-[13px]">{value}%</b>
        </div>
    );
}

export function Kpi({ label, value, hint, bar, alert }) {
    return (
        <div className="bg-surface px-5 py-4">
            <p className="pn-lab">{label}</p>
            <p className={`mt-0.5 font-display text-[28px] font-bold ${alert ? 'text-live-ink' : ''}`}>{value}</p>
            {bar !== undefined && <Bar value={bar} className="mt-2" />}
            {hint && <p className="mt-1 text-[12.5px] text-muted">{hint}</p>}
        </div>
    );
}

/* ---------- Organizar ---------- */

/**
 * Separadores de filtro em cápsula. items: [[valor, texto, contador?], …]
 * <Pills items={[['all', 'Todos'], ['done', 'Concluídos', 3]]} value={f} onChange={setF} label="Estado" />
 */
export function Pills({ items, value, onChange, label, className = '' }) {
    return (
        <div role="group" aria-label={label} className={`ui-pills ${className}`}>
            {items.map(([v, text, count]) => (
                <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>
                    {text}
                    {count !== undefined && <em>{count}</em>}
                </button>
            ))}
        </div>
    );
}

/* ---------- Camadas ---------- */

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Gaveta à direita para formulários curtos e detalhes. Leva o foco para dentro, prende o Tab
 * e devolve o foco ao botão que a abriu. `sub` é uma linha de contexto por baixo do título.
 */
export function Drawer({ title, sub, onClose, footer, width = 'w-[min(640px,100%)]', children }) {
    const panel = useRef(null);
    const closeRef = useRef(onClose);
    closeRef.current = onClose;

    useEffect(() => {
        const opener = document.activeElement;
        const el = panel.current;
        const first = el?.querySelector('.ui-drawer-b')?.querySelector(FOCUSABLE) ?? el?.querySelector(FOCUSABLE);
        (first ?? el)?.focus();

        const onKey = (e) => {
            // Com uma janela de confirmação aberta por cima, o teclado é dela
            if (document.getElementById('modal')) return;
            if (e.key === 'Escape') { closeRef.current(); return; }
            if (e.key !== 'Tab' || !el) return;
            const list = [...el.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null);
            if (!list.length) return;
            const [a, z] = [list[0], list[list.length - 1]];
            if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
            else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
        };
        document.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = '';
            if (opener && document.contains(opener)) opener.focus();
        };
    }, []);

    return (
        <>
            <div className="fixed inset-0 z-40 bg-carbon/35" onClick={onClose} aria-hidden="true" />
            <aside ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className={`fixed inset-y-0 right-0 z-50 flex ${width} flex-col bg-page shadow-[-20px_0_60px_rgba(0,0,0,.15)] outline-none`}>
                <div className="flex items-start gap-4 border-b border-line bg-surface px-6 pb-4 pt-5">
                    <div className="min-w-0">
                        <h2 className="font-display text-2xl font-bold leading-tight">{title}</h2>
                        {sub && <p className="mt-1 text-[12.5px] text-muted">{sub}</p>}
                    </div>
                    <button type="button" onClick={onClose} aria-label={t('Fechar')} className={btnClass('soft', 'sm', 'ui-btn-icon ml-auto flex-none')}><IconClose /></button>
                </div>
                <div className="ui-drawer-b flex flex-1 flex-col gap-3.5 overflow-y-auto px-6 py-5">{children}</div>
                {footer && <div className="flex flex-wrap items-center gap-2.5 border-t border-line bg-surface px-6 py-3.5">{footer}</div>}
            </aside>
        </>
    );
}

/** Aviso rápido em baixo, ao centro. Fica sempre no DOM (role="status") para ser anunciado quando muda. */
export function Toast({ message }) {
    const [last, setLast] = useState(message);
    useEffect(() => { if (message) setLast(message); }, [message]);
    return <div className={`ui-toast ${message ? 'ui-on' : ''}`} role="status">{message ? last : ''}</div>;
}

/** Mensagem de sucesso que vem do servidor (flash.status), durante 4,5 segundos. */
export function FlashToast() {
    const { flash } = usePage().props;
    const [msg, setMsg] = useState(null);
    useEffect(() => {
        if (!flash?.status) return undefined;
        setMsg(flash.status);
        const tx = setTimeout(() => setMsg(null), 4500);
        return () => clearTimeout(tx);
    }, [flash]);
    return <Toast message={msg} />;
}

/**
 * Janela de confirmação para o que não se desfaz (em vez do confirm() do browser).
 * const [confirm, confirmDialog] = useConfirm();
 * if (!(await confirm({ title: 'Apagar a aula?', body: '…', action: 'Apagar a aula', danger: true }))) return;
 * …e pôr {confirmDialog} no JSX.
 */
export function useConfirm() {
    const [open, setOpen] = useState(false);
    const [opts, setOpts] = useState(null);
    const resolver = useRef(null);

    const confirm = useCallback((o) => new Promise((resolve) => {
        resolver.current = resolve;
        setOpts(o);
        setOpen(true);
    }), []);

    const answer = (v) => {
        setOpen(false);
        resolver.current?.(v);
        resolver.current = null;
    };

    const dialog = (
        <Modal show={open} maxWidth="md" onClose={() => answer(false)}>
            {opts && (
                <div className="p-6">
                    <h2 className="font-display text-xl font-extrabold leading-tight">{opts.title}</h2>
                    {opts.body && <p className="mt-2 text-text">{opts.body}</p>}
                    <div className="mt-6 flex flex-wrap gap-2.5">
                        <Button variant={opts.danger ? 'danger' : 'primary'} onClick={() => answer(true)}>{opts.action}</Button>
                        <Button variant="soft" onClick={() => answer(false)}>{t('Cancelar')}</Button>
                    </div>
                </div>
            )}
        </Modal>
    );

    return [confirm, dialog];
}
