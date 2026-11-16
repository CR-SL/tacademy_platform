import { Button, Field } from '@/Components/ui';
import { Transition } from '@headlessui/react';
import { useForm } from '@inertiajs/react';
import { useRef } from 'react';

import { t } from '@/i18n';

export default function UpdatePasswordForm({ className = '' }) {
    const passwordInput = useRef();
    const currentPasswordInput = useRef();

    const {
        data,
        setData,
        errors,
        put,
        reset,
        processing,
        recentlySuccessful,
    } = useForm({
        current_password: '',
        password: '',
        password_confirmation: '',
    });

    const updatePassword = (e) => {
        e.preventDefault();

        put(route('password.update'), {
            preserveScroll: true,
            onSuccess: () => reset(),
            onError: (errors) => {
                if (errors.password) {
                    reset('password', 'password_confirmation');
                    passwordInput.current.focus();
                }

                if (errors.current_password) {
                    reset('current_password');
                    currentPasswordInput.current.focus();
                }
            },
        });
    };

    return (
        <section className={className}>
            <header>
                <h2 className="font-display text-lg font-bold text-ink">
                    {t('Mudar a palavra-passe')}
                </h2>

                <p className="mt-1 text-sm text-muted">
                    {t('Usa uma palavra-passe longa, que não uses noutros sítios.')}
                </p>
            </header>

            <form onSubmit={updatePassword} className="mt-6 space-y-6">
                <Field id="current_password" label={t('Palavra-passe atual')} error={errors.current_password}>
                    <input
                        id="current_password"
                        ref={currentPasswordInput}
                        value={data.current_password}
                        onChange={(e) => setData('current_password', e.target.value)}
                        type="password"
                        autoComplete="current-password"
                        className="ui-input w-full"
                    />
                </Field>

                <Field id="password" label={t('Palavra-passe nova')} error={errors.password}>
                    <input
                        id="password"
                        ref={passwordInput}
                        value={data.password}
                        onChange={(e) => setData('password', e.target.value)}
                        type="password"
                        autoComplete="new-password"
                        className="ui-input w-full"
                    />
                </Field>

                <Field id="password_confirmation" label={t('Repetir a palavra-passe nova')} error={errors.password_confirmation}>
                    <input
                        id="password_confirmation"
                        value={data.password_confirmation}
                        onChange={(e) => setData('password_confirmation', e.target.value)}
                        type="password"
                        autoComplete="new-password"
                        className="ui-input w-full"
                    />
                </Field>

                <div className="flex items-center gap-4">
                    <Button type="submit" variant="accent" disabled={processing}>{processing ? t('A guardar…') : t('Mudar a palavra-passe')}</Button>

                    <Transition
                        show={recentlySuccessful}
                        enter="transition ease-in-out"
                        enterFrom="opacity-0"
                        leave="transition ease-in-out"
                        leaveTo="opacity-0"
                    >
                        <p className="text-sm text-muted">
                            {t('Palavra-passe alterada.')}
                        </p>
                    </Transition>
                </div>
            </form>
        </section>
    );
}
