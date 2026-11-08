import { btnClass } from '@/Components/ui';

export default function SecondaryButton({ type = 'button', className = '', disabled, children, ...props }) {
    return (
        <button {...props} type={type} className={btnClass('soft', 'md', className)} disabled={disabled}>
            {children}
        </button>
    );
}
