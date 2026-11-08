export default function InputLabel({ value, className = '', children, ...props }) {
    return (
        <label {...props} className={`ui-label ${className}`}>
            {value ? value : children}
        </label>
    );
}
