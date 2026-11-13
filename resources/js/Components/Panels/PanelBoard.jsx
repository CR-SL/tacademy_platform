import { Link, usePage } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { IconArrow, IconBack, IconCorner, IconFold, IconGrip, IconPanels, IconX } from './icons';
import { Bar as UiBar, Toast } from '@/Components/ui';

import { t } from '@/i18n';
import { AlexBuy, AlexStart } from '@/Components/Alex/AlexCall';

export function Bar({ value }) {
    return <UiBar value={value} className="mt-[5px]" />;
}

// Numeração como no exemplo: "Módulo 3 · Radar". Não repete quando o título já traz "Módulo"
export const moduleName = (title, i) => (/^m[oó]dulo\b/i.test(title) ? title : t('Módulo :v1 · :title', { v1: i + 1, title }));

// Menu que fecha ao clicar fora ou com Esc
function useDismiss(open, setOpen) {
    const ref = useRef(null);
    useEffect(() => {
        if (!open) return undefined;
        const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
        const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('pointerdown', close);
        document.addEventListener('keydown', esc);
        return () => {
            document.removeEventListener('pointerdown', close);
            document.removeEventListener('keydown', esc);
        };
    }, [open, setOpen]);
    return ref;
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

// O Alex (formador IA): fala com quem tem um curso com o avatar (conversas grátis por dia) ou créditos.
// - nesta página pode falar: o botão começa a conversa;
// - pode falar, mas noutras páginas: diz onde;
// - aluno sem curso com o avatar e sem créditos: a caixa fica, com a compra de créditos;
// - os outros (sem Alex): leva ao catálogo.
export function AlexPanel() {
    const { alex } = usePage().props;
    return (
        <>
            <img className="pn-alex-p" src="/images/alex.png" alt={t('Alex, o tutor do curso, numa oficina')} />
            <div className="pn-alex-c">
                {alex?.place ? (
                    <AlexStart alex={alex} />
                ) : alex?.buy ? (
                    <AlexBuy alex={alex} lead={t('Fala com o Alex nos cursos com IA ou com créditos de avatar.')} />
                ) : alex ? (
                    <>
                        <p className="pn-alex-note">{t('Fala com o Alex no Início, nas Avaliações ou nas aulas do teu curso com formador IA.')}</p>
                        <Link href="/dashboard" className="ui-btn ui-btn-line">{t('Ir para o Início')}</Link>
                    </>
                ) : (
                    <>
                        <p className="pn-alex-note">{t('O Alex está disponível nos cursos com formador IA.')}</p>
                        <Link href="/plataforma/cursos" className="ui-btn ui-btn-line">{t('Ver o catálogo')}</Link>
                    </>
                )}
            </div>
        </>
    );
}

export const alexDef = (url, y, h) => ({
    title: t('Alex'), x: 19, y, w: 5, h, float: 'dark', summary: t('Formador IA'), compact: true, body: <AlexPanel />,
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
