export default function PrimaryButton({
    className = '',
    disabled,
    children,
    ...props
}) {
    return (
        <button
            {...props}
            className={
                `ta-cut-8 ta-press inline-flex items-center justify-center border border-transparent bg-accent px-4 py-3 font-display text-sm font-bold uppercase tracking-[0.04em] text-on-accent hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink ${
                    disabled && 'opacity-25'
                } ` + className
            }
            disabled={disabled}
        >
            {children}
        </button>
    );
}
