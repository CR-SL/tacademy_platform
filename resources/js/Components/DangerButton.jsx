export default function DangerButton({
    className = '',
    disabled,
    children,
    ...props
}) {
    return (
        <button
            {...props}
            className={
                `ta-cut-8 ta-press inline-flex items-center justify-center border border-transparent bg-live px-4 py-2.5 font-display text-sm font-bold uppercase tracking-[0.04em] text-white hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-live ${
                    disabled && 'opacity-25'
                } ` + className
            }
            disabled={disabled}
        >
            {children}
        </button>
    );
}
