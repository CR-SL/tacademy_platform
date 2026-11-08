import { btnClass } from '@/Components/ui';

// Botão principal das páginas de entrada e perfil (usa a base única de Components/ui).
export default function PrimaryButton({ className = '', disabled, children, ...props }) {
    return (
        <button {...props} className={btnClass('accent', 'md', className)} disabled={disabled}>
            {children}
        </button>
    );
}
