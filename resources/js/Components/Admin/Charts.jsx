import { Link } from '@inertiajs/react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { intlLocale, t } from '@/i18n';

// Gráficos da Administração: uma série de cada vez (a cor diz o quê, o número diz quanto),
// dica ao passar o rato e uma tabela escondida para leitores de ecrã.

export const fmtInt = (n) => Number(n).toLocaleString(intlLocale());
export const fmtEuro = (n) => Number(n).toLocaleString(intlLocale(), { style: 'currency', currency: 'EUR', minimumFractionDigits: n % 1 ? 2 : 0 });

function useTip() {
    const [tip, setTip] = useState(null);
    const bind = (html) => ({
        onMouseMove: (e) => setTip({ html, x: e.clientX, y: e.clientY }),
        onMouseLeave: () => setTip(null),
    });
    const node = tip && createPortal(
        <div className="ad-tip" role="tooltip" style={{ left: Math.min(tip.x + 14, window.innerWidth - 240), top: tip.y - 44 }}>{tip.html}</div>,
        document.body,
    );
    return [node, bind];
}

export function Empty({ children }) {
    return <p className="ad-empty">{children ?? t('Ainda não há dados neste período.')}</p>;
}

/** Colunas no tempo (meses ou dias). data: [{ label, value, tip? }] */
export function Columns({ data, unit = '', caption }) {
    const [tipNode, bind] = useTip();
    const max = Math.max(...data.map((d) => d.value), 0);
    if (!max) return <Empty />;

    return (
        <>
            <div className="ad-cols" aria-hidden="true">
                {data.map((d, i) => (
                    <div key={i} className="ad-col" {...bind(<><b>{d.tip ?? d.label}</b> · {fmtInt(d.value)}{unit}</>)}>
                        <i style={{ height: `${(d.value / max) * 100}%` }} />
                        <span>{d.label}</span>
                    </div>
                ))}
            </div>
            <table className="pn-sr"><caption>{caption}</caption><tbody>{data.map((d, i) => <tr key={i}><th>{d.tip ?? d.label}</th><td>{d.value}</td></tr>)}</tbody></table>
            {tipNode}
        </>
    );
}

/** Barras horizontais. rows: [{ name, value, tip?, href? }] */
export function HBars({ rows, format = fmtInt, caption }) {
    const [tipNode, bind] = useTip();
    const max = Math.max(...rows.map((r) => r.value), 0);
    if (!rows.length || !max) return <Empty />;

    return (
        <>
            <div aria-hidden="true">
                {rows.map((r) => {
                    const name = r.href ? <Link href={r.href} tabIndex={-1} className="hover:underline">{r.name}</Link> : r.name;
                    return (
                        <div key={r.name} className="ad-hbar" {...bind(<><b>{r.name}</b><br />{r.tip ?? format(r.value)}</>)}>
                            <span className="ad-hbar-n">{name}</span>
                            <span className="ad-hbar-t"><i style={{ width: `${(r.value / max) * 100}%` }} /></span>
                            <span className="ad-hbar-v">{format(r.value)}</span>
                        </div>
                    );
                })}
            </div>
            <table className="pn-sr"><caption>{caption}</caption><tbody>{rows.map((r) => <tr key={r.name}><th>{r.name}</th><td>{format(r.value)}</td></tr>)}</tbody></table>
            {tipNode}
        </>
    );
}

/** Conclusão por curso: concluíram · em curso · por começar. rows: [{ title, enrolled, started, done, ulid }] */
export function Completion({ rows, linkTo }) {
    const [tipNode, bind] = useTip();
    const list = rows.filter((r) => r.enrolled > 0);
    if (!list.length) return <Empty>{t('Ainda ninguém se inscreveu num curso.')}</Empty>;
    const parts = (r) => [[r.done, 'ad-s1'], [r.started - r.done, 'ad-s2'], [r.enrolled - r.started, 'ad-s3']];

    return (
        <>
            <div className="ad-legend" aria-hidden="true">
                <span><i className="ad-s1" />{t('Concluíram')}</span>
                <span><i className="ad-s2" />{t('Em curso')}</span>
                <span><i className="ad-s3" />{t('Por começar')}</span>
            </div>
            <div aria-hidden="true">
                {list.map((r) => (
                    <div key={r.title} className="ad-hbar" {...bind(<><b>{r.title}</b><br />{t(':done concluíram · :prog em curso · :none por começar', { done: r.done, prog: r.started - r.done, none: r.enrolled - r.started })}</>)}>
                        <span className="ad-hbar-n">{linkTo ? <Link href={linkTo(r)} tabIndex={-1} className="hover:underline">{r.title}</Link> : r.title}</span>
                        <span className="ad-stack">{parts(r).filter(([n]) => n > 0).map(([n, cls]) => <i key={cls} className={cls} style={{ width: `${(n / r.enrolled) * 100}%` }} />)}</span>
                        <span className="ad-hbar-v">{Math.round((r.done / r.enrolled) * 100)}%</span>
                    </div>
                ))}
            </div>
            <table className="pn-sr">
                <thead><tr><th>{t('Curso')}</th><th>{t('Concluíram')}</th><th>{t('Em curso')}</th><th>{t('Por começar')}</th></tr></thead>
                <tbody>{list.map((r) => <tr key={r.title}><th>{r.title}</th><td>{r.done}</td><td>{r.started - r.done}</td><td>{r.enrolled - r.started}</td></tr>)}</tbody>
            </table>
            {tipNode}
        </>
    );
}
