import useTheme from '@/hooks/useTheme';

export default function ThemeToggle({ className = '' }) {
    const { theme, toggle } = useTheme();
    const dark = theme === 'dark';

    return (
        <button
            type="button"
            onClick={toggle}
            title="Alternar claro/escuro"
            aria-label={dark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            className={`ta-press flex h-9 w-9 items-center justify-center rounded-full border border-line text-[15px] text-ink ${className}`}
        >
            {dark ? '☀' : '☾'}
        </button>
    );
}
