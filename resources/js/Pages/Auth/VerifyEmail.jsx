import PrimaryButton from '@/Components/PrimaryButton';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, Link, useForm } from '@inertiajs/react';

export default function VerifyEmail({ status }) {
    const { post, processing } = useForm({});

    const submit = (e) => {
        e.preventDefault();

        post(route('verification.send'));
    };

    return (
        <GuestLayout>
            <Head title="Confirmar o email" />

            <div className="mb-4 text-sm text-muted">
                Enviámos-te um email com um link. Abre-o para confirmares o teu email e começares. Se não o encontrares, vê na pasta de spam ou pede outro.
            </div>

            {status === 'verification-link-sent' && (
                <div className="mb-4 text-sm font-semibold text-accent-ink">
                    Enviámos um link novo para o email com que criaste a conta.
                </div>
            )}

            <form onSubmit={submit}>
                <div className="mt-4 flex items-center justify-between">
                    <PrimaryButton disabled={processing}>
                        Enviar outro link
                    </PrimaryButton>

                    <Link
                        href={route('logout')}
                        method="post"
                        as="button"
                        className="text-sm text-muted underline hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                        Terminar sessão
                    </Link>
                </div>
            </form>
        </GuestLayout>
    );
}
