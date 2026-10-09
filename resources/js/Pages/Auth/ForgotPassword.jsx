import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, Link, useForm } from '@inertiajs/react';

export default function ForgotPassword({ status }) {
    const { data, setData, post, processing, errors } = useForm({
        email: '',
    });

    const submit = (e) => {
        e.preventDefault();

        post(route('password.email'));
    };

    return (
        <GuestLayout>
            <Head title="Recuperar palavra-passe" />

            <h1 className="mb-1 text-xl font-bold text-ink">
                Recuperar palavra-passe
            </h1>
            <p className="mb-6 text-sm text-steel">
                Sem problema. Indica o teu email e enviamos-te um link para
                definires uma nova palavra-passe.
            </p>

            {status && (
                <div className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
                    {status}
                </div>
            )}

            <form onSubmit={submit}>
                <InputLabel htmlFor="email" value="Email" />

                <TextInput
                    id="email"
                    type="email"
                    name="email"
                    value={data.email}
                    className="mt-1 block w-full"
                    isFocused={true}
                    onChange={(e) => setData('email', e.target.value)}
                />

                <InputError message={errors.email} className="mt-2" />

                <div className="mt-6">
                    <PrimaryButton className="w-full" disabled={processing}>
                        Enviar link de recuperação
                    </PrimaryButton>
                </div>

                <p className="mt-6 text-center text-sm text-steel">
                    <Link
                        href={route('login')}
                        className="font-semibold text-tblue hover:underline"
                    >
                        ← Voltar ao início de sessão
                    </Link>
                </p>
            </form>
        </GuestLayout>
    );
}
