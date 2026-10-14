export default function Checkbox({ className = '', ...props }) {
    return (
        <input
            {...props}
            type="checkbox"
            className={
                'rounded-none border-line bg-surface text-accent focus:ring-accent ' +
                className
            }
        />
    );
}
