import { btnClass } from '@/Components/ui';

export default function DangerButton({ className = '', disabled, children, ...props }) {
    return (
        <button {...props} className={btnClass('danger', 'md', className)} disabled={disabled}>
            {children}
        </button>
    );
}
