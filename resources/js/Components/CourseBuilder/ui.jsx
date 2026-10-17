// Peças de formulário do editor de cursos (mesmo visual do resto da plataforma).

export const inputCls =
    'w-full border border-line bg-page px-3 py-2.5 text-[15px] text-ink placeholder:text-muted/70 focus:border-accent focus:bg-surface focus:outline-none focus:ring-[3px] focus:ring-accent/20';

export function Panel({ title, sub, children }) {
    return (
        <section className="ta-cut-16 bg-surface p-5 sm:p-7">
            {title && <h2 className="font-display text-[26px] font-bold leading-tight tracking-[-0.01em]">{title}</h2>}
            {sub && <p className="mb-6 mt-1.5 text-muted">{sub}</p>}
            {children}
        </section>
    );
}

export function Label({ htmlFor, required, children, hint }) {
    const cls = 'font-display text-[13px] font-semibold uppercase tracking-[0.04em]';
    const inner = (
        <>
            {children}
            {required && <span className="text-accent-ink"> *</span>}
            {hint && <span className="ml-1 font-sans text-xs font-normal normal-case tracking-normal text-muted">{hint}</span>}
        </>
    );
    return htmlFor ? <label htmlFor={htmlFor} className={cls}>{inner}</label> : <span className={cls}>{inner}</span>;
}

export function Field({ label, htmlFor, required, hint, help, children, className = '' }) {
    return (
        <div className={`mb-5 flex flex-col gap-1.5 ${className}`}>
            {label && <Label htmlFor={htmlFor} required={required} hint={hint}>{label}</Label>}
            {children}
            {help && <span className="text-[12.5px] text-muted">{help}</span>}
        </div>
    );
}

export function Seg({ options, value, onChange, label }) {
    return (
        <div role="group" aria-label={label} className="ta-cut-8 inline-flex flex-wrap gap-[3px] bg-page p-[3px]">
            {options.map(([v, text]) => (
                <button
                    key={String(v)}
                    type="button"
                    aria-pressed={value === v}
                    onClick={() => onChange(v)}
                    className={`px-3.5 py-2 font-display text-[13.5px] font-semibold transition-colors ${
                        value === v ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'
                    }`}
                >
                    {text}
                </button>
            ))}
        </div>
    );
}

export function Toggle({ checked, onChange, title, children }) {
    return (
        <label className="flex cursor-pointer items-start gap-3 border-t border-line py-3.5 first:border-t-0">
            <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
            <span className="relative mt-0.5 h-[22px] w-10 flex-none rounded-full bg-track transition-colors after:absolute after:left-[3px] after:top-[3px] after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-accent peer-checked:after:translate-x-[18px] peer-focus-visible:ring-2 peer-focus-visible:ring-accent" />
            <span>
                <b className="block font-display text-[15px] font-semibold">{title}</b>
                <small className="text-muted">{children}</small>
            </span>
        </label>
    );
}

export function IconButton({ label, danger, className = '', ...props }) {
    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            className={`inline-flex h-8 w-8 flex-none items-center justify-center bg-surface2 text-muted transition-colors hover:bg-track disabled:opacity-35 ${
                danger ? 'hover:text-live' : 'hover:text-ink'
            } ${className}`}
            {...props}
        />
    );
}

export function AddLink({ children, ...props }) {
    return (
        <button type="button" className="self-start py-1.5 text-left font-display text-[13.5px] font-semibold text-accent-ink hover:text-ink" {...props}>
            {children}
        </button>
    );
}
