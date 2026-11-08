import StudentLayout from '@/Layouts/StudentLayout';
import useTheme from '@/hooks/useTheme';
import { Head, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import DeleteUserForm from './Partials/DeleteUserForm';
import UpdatePasswordForm from './Partials/UpdatePasswordForm';
import UpdateProfileInformationForm from './Partials/UpdateProfileInformationForm';

import { t } from '@/i18n';

// Definições (menu da conta): Conta, Aparência, Notificações (quem está numa equipa) e, no fim, apagar a conta.
export default function Edit({ mustVerifyEmail, status, inTeam }) {
    return (
        <StudentLayout>
            <Head title={t('Definições')} />

            <div className="mx-auto max-w-3xl">
                <h1 className="mb-8 font-display text-[clamp(28px,3.2vw,42px)] font-bold leading-none tracking-[-0.01em]">{t('Definições')}</h1>

                <section aria-labelledby="def-conta" className="mb-10">
                    <h2 id="def-conta" className="pn-lab mb-3">{t('Conta')}</h2>
                    <div className="space-y-3">
                        <div className="bg-surface p-6">
                            <UpdateProfileInformationForm mustVerifyEmail={mustVerifyEmail} status={status} className="max-w-xl" />
                        </div>
                        <div className="bg-surface p-6">
                            <UpdatePasswordForm className="max-w-xl" />
                        </div>
                    </div>
                </section>

                <section aria-labelledby="def-aparencia" className="mb-10">
                    <h2 id="def-aparencia" className="pn-lab mb-3">{t('Aparência')}</h2>
                    <div className="bg-surface p-6">
                        <ThemeSettings />
                        <div className="mt-8 border-t border-line pt-6"><LanguageSettings /></div>
                    </div>
                </section>

                {inTeam && (
                    <section aria-labelledby="def-notificacoes" className="mb-10">
                        <h2 id="def-notificacoes" className="pn-lab mb-3">{t('Notificações')}</h2>
                        <div className="bg-surface p-6">
                            <NotificationSettings />
                        </div>
                    </section>
                )}

                <section aria-labelledby="def-apagar">
                    <h2 id="def-apagar" className="sr-only">{t('Apagar a conta')}</h2>
                    <div className="bg-surface p-6">
                        <DeleteUserForm className="max-w-xl" />
                    </div>
                </section>
            </div>
        </StudentLayout>
    );
}

const THEMES = [
    ['light', 'Claro', 'Fundo claro, para o dia e para a oficina.'],
    ['dark', 'Escuro', 'Fundo escuro, cansa menos a vista à noite.'],
    ['system', 'Automático', 'Segue o computador ou o telemóvel.'],
];

/** Tema: guarda logo na conta ao escolher (sem botão de guardar); vale em todos os aparelhos. */
/** Língua da plataforma: guarda logo na conta. O conteúdo dos cursos fica na língua do formador. */
function LanguageSettings() {
    const { locale } = usePage().props;
    const options = [['pt', 'Português', 'pt-PT'], ['en', 'English', 'en']];

    return (
        <fieldset>
            <legend className="font-display text-lg font-bold text-ink">{t('Língua')}</legend>
            <p className="mt-1 text-sm text-muted">{t('Muda os menus, os botões e os emails da plataforma. Os cursos ficam na língua em que o formador os escreveu.')}</p>
            <div className="mt-4 flex flex-wrap gap-3">
                {options.map(([value, label, lang]) => {
                    const on = locale === value;
                    return (
                        <label key={value} lang={lang} className={`flex cursor-pointer items-center gap-2.5 px-4 py-3 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent ${on ? 'bg-surface2 shadow-[inset_0_0_0_2px_var(--color-ink)]' : 'bg-page shadow-[inset_0_0_0_1px_var(--color-line)] hover:bg-surface2'}`}>
                            <input type="radio" name="locale" value={value} checked={on} onChange={() => router.put('/lingua', { locale: value }, { preserveScroll: true, preserveState: true })} className="h-4 w-4 border-field text-ink focus:ring-0" />
                            <b className="text-[15px] font-semibold">{label}</b>
                        </label>
                    );
                })}
            </div>
        </fieldset>
    );
}

function ThemeSettings() {
    const { pref, theme, setPref } = useTheme();

    return (
        <fieldset>
            <legend className="font-display text-lg font-bold text-ink">{t('Tema')}</legend>
            <p className="mt-1 text-sm text-muted">{t('Fica guardado na tua conta, igual no computador e no telemóvel.')}</p>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {THEMES.map(([value, pl, ph]) => { const [label, hint] = [t(pl), t(ph)];
                    const on = pref === value;
                    return (
                        <label
                            key={value}
                            className={`flex cursor-pointer flex-col gap-3 p-3 transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent ${on ? 'bg-surface2 shadow-[inset_0_0_0_2px_var(--color-ink)]' : 'bg-page shadow-[inset_0_0_0_1px_var(--color-line)] hover:bg-surface2'}`}
                        >
                            <ThemePreview kind={value} />
                            <span className="flex items-start gap-2.5">
                                <input type="radio" name="theme" value={value} checked={on} onChange={() => setPref(value)} className="mt-0.5 h-4 w-4 border-field text-ink focus:ring-0" />
                                <span>
                                    <b className="block text-[15px] font-semibold">{label}</b>
                                    <span className="block text-[13px] text-muted">{hint}</span>
                                </span>
                            </span>
                        </label>
                    );
                })}
            </div>

            <p className="mt-4 text-[13px] text-muted" aria-live="polite">
                {pref === 'system' ? t('Agora está :v1, como o teu sistema.', { v1: theme === 'dark' ? t('escuro') : t('claro') }) : t('Também podes mudar depressa no botão da lua, na barra de cima.')}
            </p>
        </fieldset>
    );
}

// Miniatura da plataforma em cada tema (cores fixas: mostram o tema, não o atual)
const SWATCH = {
    light: { bg: '#F5F3EE', box: '#FFFFFF', ink: '#111111', line: '#E7E4DD' },
    dark: { bg: '#0F1013', box: '#191B20', ink: '#F4F4F2', line: '#2C2F36' },
};

function Mini({ s }) {
    return (
        <span className="flex h-full flex-1 flex-col gap-1.5 p-2" style={{ background: s.bg }}>
            <span className="block h-1.5 w-1/2" style={{ background: s.ink }} />
            <span className="flex flex-1 flex-col gap-1 p-1.5" style={{ background: s.box }}>
                <span className="block h-1 w-3/4" style={{ background: s.line }} />
                <span className="block h-1 w-full" style={{ background: s.line }} />
                <span className="mt-auto block h-1 w-2/3 bg-accent" />
            </span>
        </span>
    );
}

function ThemePreview({ kind }) {
    return (
        <span className="flex h-20 overflow-hidden shadow-[inset_0_0_0_1px_var(--color-line)]" aria-hidden="true">
            {kind === 'system'
                ? <><Mini s={SWATCH.light} /><Mini s={SWATCH.dark} /></>
                : <Mini s={SWATCH[kind]} />}
        </span>
    );
}

/** Lembretes do team leader: o aluno pode desligá-los. Guarda logo ao mudar. */
function NotificationSettings() {
    const user = usePage().props.auth?.user;
    const [on, setOn] = useState(user?.email_reminders !== false);
    const [state, setState] = useState(null); // null | saving | saved | error

    const change = async (value) => {
        setOn(value);
        setState('saving');
        try {
            await window.axios.put('/definicoes/notificacoes', { reminders: value });
            setState('saved');
        } catch {
            setOn(!value);
            setState('error');
        }
    };

    return (
        <div>
            <h3 className="font-display text-lg font-bold text-ink">{t('Emails')}</h3>
            <p className="mt-1 text-sm text-muted">{t('Os emails sobre o acesso aos cursos, os cursos que te atribuem e a palavra-passe chegam sempre.')}</p>

            <label className="mt-5 flex cursor-pointer items-start gap-3">
                <input type="checkbox" className="ui-check mt-0.5" checked={on} onChange={(e) => change(e.target.checked)} />
                <span>
                    <b className="block text-[15px] font-semibold">{t('Lembretes do team leader')}</b>
                    <span className="block text-[13px] text-muted">{t('Quando o team leader da tua equipa te lembra de continuar um curso.')}</span>
                </span>
            </label>

            <p className={`mt-4 text-[13px] ${state === 'error' ? 'text-live-ink' : 'text-muted'}`} aria-live="polite">
                {state === 'saving' && t('A guardar…')}
                {state === 'saved' && (on ? t('Guardado. Vais receber os lembretes.') : t('Guardado. Deixas de receber os lembretes; o team leader vê que os desligaste.'))}
                {state === 'error' && t('Não foi possível guardar. Tenta outra vez.')}
            </p>
        </div>
    );
}
