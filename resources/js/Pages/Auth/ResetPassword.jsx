import { Button, Field } from '@/Components/ui';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, useForm } from '@inertiajs/react';

import { t } from '@/i18n';

export default function ResetPassword({ token, email }) {
    const { data, setData, post, processing, errors, reset } = useForm({
        token: token,
        email: email,
        password: '',
        password_confirmation: '',
    });

    const submit = (e) => {
        e.preventDefault();

        post(route('password.store'), {
            onFinish: () => reset('password', 'password_confirmation'),
        });
    };

    return (
        <GuestLayout>
            <Head title={t('Definir nova palavra-passe')} />

            <h1 className="mb-1 font-display text-2xl font-bold uppercase text-ink">
                {t('Nova palavra-passe')}
            </h1>
            <p className="mb-6 text-sm text-muted">
                {t('Escolhe uma nova palavra-passe para a tua conta.')}
            </p>

            {/* Field liga o erro a cada campo (o leitor de ecrã lê-o ao entrar no campo) */}
            <form onSubmit={submit} className="flex flex-col gap-4">
                <Field id="email" label={t('Email')} error={errors.email}>
                    <input
                        id="email"
                        type="email"
                        name="email"
                        value={data.email}
                        className="ui-input w-full"
                        autoComplete="username"
                        onChange={(e) => setData('email', e.target.value)}
                    />
                </Field>

                <Field id="password" label={t('Palavra-passe')} error={errors.password}>
                    <input
                        id="password"
                        type="password"
                        name="password"
                        value={data.password}
                        className="ui-input w-full"
                        autoComplete="new-password"
                        autoFocus
                        onChange={(e) => setData('password', e.target.value)}
                    />
                </Field>

                <Field id="password_confirmation" label={t('Confirmar palavra-passe')} error={errors.password_confirmation}>
                    <input
                        id="password_confirmation"
                        type="password"
                        name="password_confirmation"
                        value={data.password_confirmation}
                        className="ui-input w-full"
                        autoComplete="new-password"
                        onChange={(e) => setData('password_confirmation', e.target.value)}
                    />
                </Field>

                <Button type="submit" variant="accent" block className="mt-2" disabled={processing}>
                    {t('Guardar nova palavra-passe')}
                </Button>
            </form>
        </GuestLayout>
    );
}
