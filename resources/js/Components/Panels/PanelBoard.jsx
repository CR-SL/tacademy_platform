import { Link } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconArrow, IconBack, IconCorner, IconFold, IconGrip, IconPanels, IconSwap, IconX } from './icons';
import { Bar as UiBar, Toast } from '@/Components/ui';

import { t } from '@/i18n';

export function Bar({ value }) {
    return <UiBar value={value} className="mt-[5px]" />;
}

// Numeração como no exemplo: "Módulo 3 · Radar". Não repete quando o título já traz "Módulo"
export const moduleName = (title, i) => (/^m[oó]dulo\b/i.test(title) ? title : t('Módulo :v1 · :title', { v1: i + 1, title }));

// Menus que fecham ao clicar fora ou com Esc (extra: outra parte do menu, por exemplo num portal)
function useDismiss(open, setOpen, extra) {
    const ref = useRef(null);
    useEffect(() => {
        if (!open) return undefined;
        const close = (e) => { if (!ref.current?.contains(e.target) && !extra?.current?.contains(e.target)) setOpen(false); };
        const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('pointerdown', close);
        document.addEventListener('keydown', esc);
        return () => {
            document.removeEventListener('pointerdown', close);
            document.removeEventListener('keydown', esc);
        };
    }, [open, setOpen, extra]);
    return ref;
}

// Menu de cada caixa: trocar de lugar com outra (aberta: trocam; fechada: abre aqui e esta fecha)
// A caixa esconde o que sai dela, por isso o menu abre por cima da página (portal), junto ao botão.
function SwapMenu({ board, id, title }) {
    const [open, setOpen] = useState(false);
    const [at, setAt] = useState(null);
    const menu = useRef(null);
    const ref = useDismiss(open, setOpen, menu);
    useEffect(() => {
        if (!open) return undefined;
        const shut = () => setOpen(false);
        // Só o scroll da página fecha o menu (o carrossel das Sugestões anda sozinho e não conta)
        addEventListener('scroll', shut);
        addEventListener('resize', shut);
        return () => { removeEventListener('scroll', shut); removeEventListener('resize', shut); };
    }, [open]);
    const others = Object.keys(board.layout.items).filter((k) => k !== id);
    if (!others.length) return null;

    const toggle = () => {
        const r = ref.current.getBoundingClientRect();
        setAt({ top: r.bottom + 4, right: Math.max(8, innerWidth - r.right) });
        setOpen((o) => !o);
    };

    return (
        <div ref={ref} className="pn-swap">
            <button type="button" className="pn-tool" aria-haspopup="true" aria-expanded={open} aria-label={t('Trocar :title de lugar', { title })} title={t('Trocar de lugar')} onClick={toggle}><IconSwap /></button>
            {open && at && createPortal(
                <div ref={menu} className="pn-menu pn-swap-m" style={{ position: 'fixed', top: at.top, right: at.right }}>
                    <h2 className="pn-lab">{t('Trocar de lugar com')}</h2>
                    {others.map((k) => (
                        <button key={k} type="button" onClick={() => { board.swap(id, k); setOpen(false); }}>
                            {board.titles[k]}
                            {board.layout.hidden.includes(k) && <small>{t('fechada')}</small>}
                        </button>
                    ))}
                </div>,
                document.body,
            )}
        </div>
    );
}

function Box({ board, id, panel }) {
    const { layout, gesture, flags } = board;
    const it = layout.items[id];
    const f = flags(id);
    const title = panel.title;
    const classes = [
        'pn-box',
        panel.compact && 'pn-compact',
        panel.float === 'dark' && 'pn-float pn-float-d',
        panel.float === 'light' && 'pn-float',
        f.collapsed && 'pn-is-col',
        f.atRight && 'pn-at-right',
        f.hasRight && 'pn-has-right',
        f.hasBelow && 'pn-has-below',
        gesture.lifted === id && 'pn-lifted',
        gesture.resizing === id && 'pn-rzing',
    ].filter(Boolean).join(' ');
    const style = { '--x': it.x, '--y': it.y, '--w': it.w, '--h': f.h, '--o': layout.order.indexOf(id) };

    const header = (
        <div className="pn-box-h" data-drag>
            <button type="button" className="pn-grip" data-grip aria-label={t('Mover :title. Usa as setas do teclado.', { title })} title={t('Arrastar')}><IconGrip /></button>
            <h2 className="pn-lab">{panel.label ?? title}</h2>
            {panel.summary && <span className="pn-sum">{panel.summary}</span>}
            {panel.mini}
            <span className="pn-tools">
                {board.swappable && <SwapMenu board={board} id={id} title={title} />}
                <button type="button" className="pn-tool pn-fold" aria-expanded={!f.collapsed} aria-label={`${f.collapsed ? t('Abrir') : t('Minimizar')} ${title}`} title={f.collapsed ? t('Abrir') : t('Minimizar')} onClick={() => board.toggleFold(id)}><IconFold /></button>
                <button type="button" className="pn-tool" aria-label={t('Fechar :title', { title })} title={t('Fechar')} onClick={() => board.hide(id)}><IconX /></button>
            </span>
        </div>
    );

    return (
        <section className={classes} style={style} data-mod={id} aria-label={title}>
            <div className="pn-box-i">
                {panel.hero ? (
                    <div className="pn-hero">
                        <div className="pn-hero-p">
                            <img src={panel.hero.image} alt="" />
                            {panel.hero.stamp && <span className="pn-stamp">{panel.hero.stamp}</span>}
                        </div>
                        <div className="pn-hero-r">
                            {header}
                            <div className="pn-hero-b">{panel.body}</div>
                        </div>
                    </div>
                ) : (
                    <>
                        {header}
                        <div className="pn-box-b">{panel.body}</div>
                    </>
                )}
            </div>
            <div className="pn-edge pn-e" data-rz="e" />
            <div className="pn-edge pn-w" data-rz="w" />
            <div className="pn-edge pn-s" data-rz="s" />
            <button type="button" className="pn-rz pn-se" data-rz="se" data-corner aria-label={t('Redimensionar :title. Usa as setas do teclado.', { title })} title={t('Arrastar para redimensionar. Duplo clique repõe o tamanho.')}><IconCorner /></button>
            <button type="button" className="pn-rz pn-sw" data-rz="sw" data-corner aria-label={t('Redimensionar :title. Usa as setas do teclado.', { title })} title={t('Arrastar para redimensionar. Duplo clique repõe o tamanho.')}><IconCorner /></button>
        </section>
    );
}

export default function PanelBoard({ board }) {
    const { panels, visible, rows, boardRef, gesture, layout, narrow, flags, message, toast } = board;
    const lifted = gesture.lifted && !narrow ? layout.items[gesture.lifted] : null;

    return (
        <div className="pn-root">
            <div className="pn-board" ref={boardRef} style={{ '--rows': rows }}>
                {visible.map((id) => <Box key={id} board={board} id={id} panel={panels[id]} />)}
                {lifted && <div className="pn-ph" style={{ '--x': lifted.x, '--y': lifted.y, '--w': lifted.w, '--h': flags(gesture.lifted).h }} />}
            </div>
            <div className="pn-sr" aria-live="polite">{message}</div>
            <Toast message={toast} />
        </div>
    );
}

// Botão da navbar com a lista dos painéis e "Repor disposição inicial"
export function PanelsMenu({ board }) {
    const [open, setOpen] = useState(false);
    const ref = useDismiss(open, setOpen);

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button type="button" className="pn-icon" aria-label={t('Painéis visíveis')} title={t('Painéis visíveis')} aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((o) => !o)}><IconPanels /></button>
            {open && (
                <div className="pn-menu">
                    <h2 className="pn-lab">{t('Painéis visíveis')}</h2>
                    {Object.keys(board.layout.items).map((id) => {
                        const shownNow = !board.layout.hidden.includes(id);
                        // A última caixa aberta não se fecha (fica sempre pelo menos uma)
                        const last = shownNow && Object.keys(board.layout.items).length - board.layout.hidden.length <= 1;
                        return (
                            <label key={id}>
                                <input
                                    type="checkbox"
                                    checked={shownNow}
                                    disabled={last}
                                    title={last ? t('Fica sempre pelo menos uma caixa aberta.') : undefined}
                                    onChange={(e) => (e.target.checked ? board.show(id) : board.hide(id))}
                                />
                                {board.titles[id]}
                            </label>
                        );
                    })}
                    <button type="button" className="pn-rs" onClick={() => { board.reset(); setOpen(false); }}>{t('Repor disposição inicial')}</button>
                </div>
            )}
        </div>
    );
}

// Faixa de cima das páginas interiores: voltar ao início e onde estamos
export function Crumb({ label, children }) {
    return (
        <div className="pn-root">
            <div className="pn-crumb">
                <Link href="/dashboard" className="pn-back"><IconBack />{t('Início')}</Link>
                <span className="pn-lab">{label}</span>
                {children && <><span className="pn-sp" />{children}</>}
            </div>
        </div>
    );
}

// O Alex: a API do avatar ainda não está ligada, por isso o botão só abre uma aula com avatar que já exista
export function AlexPanel({ url }) {
    return (
        <>
            <img className="pn-alex-p" src="/images/alex.png" alt={t('Alex, o tutor do curso, numa oficina')} />
            <div className="pn-alex-c">
                {url ? (
                    <Link href={url} className="ui-btn ui-btn-line">{t('Falar com o Alex')}</Link>
                ) : (
                    <>
                        <button type="button" className="ui-btn ui-btn-line" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}>{t('Falar com o Alex')}</button>
                        <p className="pn-alex-note">{t('O Alex vai estar disponível em breve.')}</p>
                    </>
                )}
            </div>
        </>
    );
}

export const alexDef = (url, y, h) => ({
    title: t('Alex'), x: 19, y, w: 5, h, float: 'dark', summary: t('Tutor do curso'), compact: true, body: <AlexPanel url={url} />,
});

export function EmptyPanel({ title, text, href, cta }) {
    return (
        <div className="pn-empty-c">
            <h3 className="pn-disp">{title}</h3>
            {text && <p>{text}</p>}
            {href && <Link href={href} className="ui-btn">{cta}<IconArrow /></Link>}
        </div>
    );
}
