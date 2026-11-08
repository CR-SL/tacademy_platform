export default function InputError({ message, className = '', ...props }) {
    return message ? (
        <p {...props} className={`ui-err ${className}`}>
            {message}
        </p>
    ) : null;
}
