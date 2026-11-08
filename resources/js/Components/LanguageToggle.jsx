import { router, usePage } from '@inertiajs/react';
import { t } from '@/i18n';

// PT · EN: muda logo a língua da plataforma e guarda-a (na conta, ou neste browser antes de entrar).
// O conteúdo dos cursos fica na língua em que o formador o escreveu.
export default function LanguageToggle({ className = 'pn-lang' }) {
    const { locale } = usePage().props;
    const set = (next) => {
        if (next === locale) return;
        router.put('/lingua', { locale: next }, { preserveScroll: true, preserveState: true });
    };

    return (
        <span className={className} role="group" aria-label={t('Língua')}>
            {['pt', 'en'].map((l, i) => (
                <span key={l}>
                    {i > 0 && <span aria-hidden="true"> · </span>}
                    <button type="button" lang={l} aria-pressed={locale === l} title={l === 'pt' ? 'Português' : 'English'} onClick={() => set(l)}>
                        {l.toUpperCase()}
                    </button>
                </span>
            ))}
        </span>
    );
}
