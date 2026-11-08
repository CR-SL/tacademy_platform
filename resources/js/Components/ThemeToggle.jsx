import useTheme from '@/hooks/useTheme';

import { t } from '@/i18n';

export default function ThemeToggle({ className = '' }) {
    const { theme, toggle } = useTheme();
    const dark = theme === 'dark';

    return (
        <button
            type="button"
            onClick={toggle}
            title={t('Alternar claro/escuro')}
            aria-label={dark ? t('Mudar para tema claro') : t('Mudar para tema escuro')}
            className={`ta-press flex h-9 w-9 items-center justify-center rounded-full border border-line text-[15px] text-ink ${className}`}
        >
            {dark ? '☀' : '☾'}
        </button>
    );
}
