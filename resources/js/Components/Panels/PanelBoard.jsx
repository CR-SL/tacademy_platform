import { Link, usePage } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { IconArrow, IconBack, IconCorner, IconFold, IconGrip, IconPanels, IconX } from './icons';
import { Bar as UiBar, Toast } from '@/Components/ui';

import { t } from '@/i18n';
import { AlexStart, avatarAway } from '@/Components/Alex/AlexCall';
import { useAlexCall } from '@/Components/Alex/alexStore';

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
        panel.showSum && 'pn-show-sum',
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
    // Com a conversa na janela flutuante, a caixa do avatar fica oculta (o lugar dela fica livre até a conversa acabar)
    const away = avatarAway(useAlexCall());

    return (
        <div className="pn-root">
            <div className="pn-board" ref={boardRef} style={{ '--rows': rows }}>
                {visible.filter((id) => !(away && panels[id].avatar)).map((id) => <Box key={id} board={board} id={id} panel={panels[id]} />)}
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

// O avatar de dúvidas do curso do aluno (ainda não há um avatar geral da plataforma, 2026-11-27):
// - no Início, em Os meus cursos, nos Documentos e na Equipa: o botão começa a conversa com o avatar do curso onde o aluno esteve por último;
// - noutras páginas: diz onde se fala com ele;
// - sem um curso com o avatar: leva ao catálogo.
export function AlexPanel() {
    const { alex } = usePage().props;
    return (
        <div className="pn-alex">
            <img className="pn-alex-p" src="/images/alex.png" alt="" />
            <div className="pn-alex-c">
                {alex?.place ? (
                    <>
                        <p className="pn-alex-note">{t(':name tira-te dúvidas sobre o curso “:course”.', { name: alex.name, course: alex.course })}</p>
                        <AlexStart alex={alex} hint={false} />
                    </>
                ) : alex ? (
                    <>
                        <p className="pn-alex-note">{t('Fala com :name no Início, em Os meus cursos ou nas aulas do teu curso.', { name: alex.name })}</p>
                        <Link href="/dashboard" className="ui-btn ui-btn-line">{t('Ir para o Início')}</Link>
                    </>
                ) : (
                    <>
                        <p className="pn-alex-note">{t('Os cursos com avatar trazem um avatar que te tira dúvidas sobre a matéria.')}</p>
                        <Link href="/plataforma/cursos" className="ui-btn ui-btn-line">{t('Ver o catálogo')}</Link>
                    </>
                )}
            </div>
        </div>
    );
}

// A caixa do avatar tem o mesmo tamanho em todas as páginas (2026-11-28); só muda o lugar.
// Não fica mais pequena do que o mínimo em que se vê o texto e o botão "Falar com".
export const ALEX_BOX = { w: 5, h: 12, minW: 5, minH: 6 };
export const alexDef = (x, y = 0) => ({
    title: t('Avatar do curso'), x, y, ...ALEX_BOX, float: 'dark', summary: t('Dúvidas sobre o curso'), compact: true, avatar: true, body: <AlexPanel />,
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
