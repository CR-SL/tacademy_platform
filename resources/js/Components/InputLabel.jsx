export default function InputLabel({
    value,
    className = '',
    children,
    ...props
}) {
    return (
        <label
            {...props}
            className={
                `block font-display text-[13px] font-semibold uppercase tracking-[0.06em] text-muted ` +
                className
            }
        >
            {value ? value : children}
        </label>
    );
}
