// Peças comuns às páginas de equipas e pedidos (mesmo visual do resto da plataforma).
import { Link } from '@inertiajs/react';

// Botões e campos vêm da base única (Components/ui); os nomes antigos ficam para não mexer nas páginas.
import { Chip, Drawer, FlashToast, Kpi, Pills, Progress, btn, inputCls } from '@/Components/ui';

export { Chip, Drawer, FlashToast, Kpi, Progress, btn, inputCls };

/** Separadores de filtro (o mesmo componente que a área do aluno usa). */
export const Tabs = (props) => <Pills className="mb-4" {...props} />;

/** Cabeçalho das páginas de gestão. back = { href, label } para voltar à lista (sem etiqueta por cima do título). */
export function PageHead({ back, title, sub, children }) {
    return (
        <div className="mb-6 flex flex-wrap items-end justify-between gap-5">
            <div>
                {back && <Link href={back.href} className="ui-link mb-3 inline-block text-[13px]">{back.label}</Link>}
                <h1 className="font-display text-[clamp(28px,3.2vw,42px)] font-bold leading-none tracking-[-0.01em]">{title}</h1>
                {sub && <p className="mt-2 text-muted">{sub}</p>}
            </div>
            {children && <div className="flex flex-wrap gap-2.5">{children}</div>}
        </div>
    );
}

export function Box({ title, right, children }) {
    return (
        <section className="bg-surface px-5 py-4">
            {title && (
                <h3 className="pn-lab mb-2.5 flex items-center justify-between">
                    {title}
                    {right}
                </h3>
            )}
            {children}
        </section>
    );
}

export const Th = ({ children, className = '' }) => (
    <th className={`whitespace-nowrap border-b border-line px-3 py-2.5 text-left font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted ${className}`}>{children}</th>
);
export const Td = ({ children, className = '' }) => <td className={`border-b border-line px-3 py-3 align-middle ${className}`}>{children}</td>;
