import { Link } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { IconArrow, IconBack, IconCorner, IconFold, IconGrip, IconPanels, IconX } from './icons';

export function Bar({ value }) {
    return <span className="pn-bar"><i style={{ width: `${value}%` }} /></span>;
}

// Numeração como no exemplo: "Módulo 3 · Radar". Não repete quando o título já traz "Módulo"
export const moduleName = (title, i) => (/^m[oó]dulo\b/i.test(title) ? title : `Módulo ${i + 1} · ${title}`);

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
            <button type="button" className="pn-grip" data-grip aria-label={`Mover ${title}. Usa as setas do teclado.`} title="Arrastar"><IconGrip /></button>
            <h2 className="pn-lab">{panel.label ?? title}</h2>
            {panel.summary && <span className="pn-sum">{panel.summary}</span>}
            {panel.mini}
            <span className="pn-tools">
                <button type="button" className="pn-tool pn-fold" aria-expanded={!f.collapsed} aria-label={`${f.collapsed ? 'Abrir' : 'Minimizar'} ${title}`} title={f.collapsed ? 'Abrir' : 'Minimizar'} onClick={() => board.toggleFold(id)}><IconFold /></button>
                <button type="button" className="pn-tool" aria-label={`Fechar ${title}`} title="Fechar" onClick={() => board.hide(id)}><IconX /></button>
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
            <button type="button" className="pn-rz pn-se" data-rz="se" data-corner aria-label={`Redimensionar ${title}. Usa as setas do teclado.`} title="Arrastar para redimensionar. Duplo clique repõe o tamanho."><IconCorner /></button>
            <button type="button" className="pn-rz pn-sw" data-rz="sw" data-corner aria-label={`Redimensionar ${title}. Usa as setas do teclado.`} title="Arrastar para redimensionar. Duplo clique repõe o tamanho."><IconCorner /></button>
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
            <div className={`pn-toast ${toast ? 'pn-on' : ''}`} role="status">{toast}</div>
        </div>
    );
}

// Botão da navbar com a lista dos painéis e "Repor disposição inicial"
export function PanelsMenu({ board }) {
    const [open, setOpen] = useState(false);
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
    }, [open]);

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button type="button" className="pn-icon" aria-label="Painéis visíveis" title="Painéis visíveis" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((o) => !o)}><IconPanels /></button>
            {open && (
                <div className="pn-menu">
                    <h2 className="pn-lab">Painéis visíveis</h2>
                    {Object.keys(board.layout.items).map((id) => (
                        <label key={id}>
                            <input type="checkbox" checked={!board.layout.hidden.includes(id)} onChange={(e) => (e.target.checked ? board.show(id) : board.hide(id))} />
                            {board.titles[id]}
                        </label>
                    ))}
                    <button type="button" className="pn-rs" onClick={() => { board.reset(); setOpen(false); }}>Repor disposição inicial</button>
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
                <Link href="/dashboard" className="pn-back"><IconBack />Início</Link>
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
            <img className="pn-alex-p" src="/images/alex.png" alt="Alex, o tutor do curso, numa oficina" />
            <div className="pn-alex-c">
                {url ? (
                    <Link href={url} className="pn-btn pn-line">Falar com o Alex</Link>
                ) : (
                    <>
                        <button type="button" className="pn-btn pn-line" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}>Falar com o Alex</button>
                        <p className="pn-alex-note">O Alex vai estar disponível em breve.</p>
                    </>
                )}
            </div>
        </>
    );
}

export const alexDef = (url, y, h) => ({
    title: 'Alex', x: 19, y, w: 5, h, float: 'dark', summary: 'Tutor do curso', compact: true, body: <AlexPanel url={url} />,
});

export function EmptyPanel({ title, text, href, cta }) {
    return (
        <div className="pn-empty-c">
            <h3 className="pn-disp">{title}</h3>
            {text && <p>{text}</p>}
            {href && <Link href={href} className="pn-btn">{cta}<IconArrow /></Link>}
        </div>
    );
}
