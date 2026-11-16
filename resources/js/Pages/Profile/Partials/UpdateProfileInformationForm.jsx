import { Button, Field } from '@/Components/ui';
import { Transition } from '@headlessui/react';
import { Link, useForm, usePage } from '@inertiajs/react';

import { t } from '@/i18n';

export default function UpdateProfileInformation({
    mustVerifyEmail,
    status,
    className = '',
}) {
    const user = usePage().props.auth.user;

    const { data, setData, patch, errors, processing, recentlySuccessful } =
        useForm({
            name: user.name,
            email: user.email,
        });

    const submit = (e) => {
        e.preventDefault();

        patch(route('profile.update'));
    };

    return (
        <section className={className}>
            <header>
                <h2 className="font-display text-lg font-bold text-ink">
                    {t('Os teus dados')}
                </h2>

                <p className="mt-1 text-sm text-muted">
                    {t('O teu nome e o email com que entras na plataforma.')}
                </p>
            </header>

            <form onSubmit={submit} className="mt-6 space-y-6">
                <Field id="name" label={t('Nome')} error={errors.name}>
                    <input
                        id="name"
                        value={data.name}
                        onChange={(e) => setData('name', e.target.value)}
                        required
                        autoFocus
                        autoComplete="name"
                        className="ui-input w-full"
                    />
                </Field>

                <Field id="email" label={t('Email')} error={errors.email}>
                    <input
                        id="email"
                        type="email"
                        value={data.email}
                        onChange={(e) => setData('email', e.target.value)}
                        required
                        autoComplete="username"
                        className="ui-input w-full"
                    />
                </Field>

                {mustVerifyEmail && user.email_verified_at === null && (
                    <div>
                        <p className="mt-2 text-sm text-ink">
                            {t('Ainda não confirmaste este email.')}{' '}
                            <Link
                                href={route('verification.send')}
                                method="post"
                                as="button"
                                className="text-sm text-muted underline hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                            >
                                {t('Enviar outro link de confirmação')}
                            </Link>
                        </p>

                        {status === 'verification-link-sent' && (
                            <div className="mt-2 text-sm font-semibold text-accent-ink">
                                {t('Enviámos um link novo para o teu email.')}
                            </div>
                        )}
                    </div>
                )}

                <div className="flex items-center gap-4">
                    <Button type="submit" variant="accent" disabled={processing}>{processing ? t('A guardar…') : t('Guardar')}</Button>

                    <Transition
                        show={recentlySuccessful}
                        enter="transition ease-in-out"
                        enterFrom="opacity-0"
                        leave="transition ease-in-out"
                        leaveTo="opacity-0"
                    >
                        <p className="text-sm text-muted">
                            {t('Guardado.')}
                        </p>
                    </Transition>
                </div>
            </form>
        </section>
    );
}
