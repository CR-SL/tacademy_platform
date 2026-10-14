export default function SecondaryButton({
    type = 'button',
    className = '',
    disabled,
    children,
    ...props
}) {
    return (
        <button
            {...props}
            type={type}
            className={
                `ta-cut-8 ta-press inline-flex items-center justify-center border border-line bg-surface2 px-4 py-2.5 font-display text-sm font-bold uppercase tracking-[0.04em] text-ink hover:bg-track focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-25 ${
                    disabled && 'opacity-25'
                } ` + className
            }
            disabled={disabled}
        >
            {children}
        </button>
    );
}
