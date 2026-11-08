import Modal from '@/Components/Modal';
import { Button, Field } from '@/Components/ui';
import { useForm } from '@inertiajs/react';
import { useRef, useState } from 'react';

// Apagar a conta: pede a palavra-passe numa janela de confirmação, porque não se pode desfazer.
export default function DeleteUserForm({ className = '' }) {
    const [confirmingUserDeletion, setConfirmingUserDeletion] = useState(false);
    const passwordInput = useRef();

    const {
        data,
        setData,
        delete: destroy,
        processing,
        reset,
        errors,
        clearErrors,
    } = useForm({
        password: '',
    });

    const deleteUser = (e) => {
        e.preventDefault();

        destroy(route('profile.destroy'), {
            preserveScroll: true,
            onSuccess: () => closeModal(),
            onError: () => passwordInput.current.focus(),
            onFinish: () => reset(),
        });
    };

    const closeModal = () => {
        setConfirmingUserDeletion(false);
        clearErrors();
        reset();
    };

    return (
        <section className={`space-y-6 ${className}`}>
            <header>
                <h2 className="font-display text-lg font-bold text-ink">Apagar a conta</h2>
                <p className="mt-1 text-sm text-muted">
                    Perdes os cursos, o progresso, as notas e os certificados. Isto não se pode desfazer.
                </p>
            </header>

            <Button variant="danger" onClick={() => setConfirmingUserDeletion(true)}>
                Apagar a conta
            </Button>

            <Modal show={confirmingUserDeletion} onClose={closeModal} maxWidth="md">
                <form onSubmit={deleteUser} className="p-6">
                    <h2 className="font-display text-xl font-extrabold leading-tight">Apagar a tua conta?</h2>
                    <p className="mt-2 text-text">
                        Perdes os cursos, o progresso, as notas e os certificados. Isto não se pode desfazer.
                    </p>

                    <Field id="password" label="Palavra-passe" hint="Escreve a tua palavra-passe para confirmar." error={errors.password} className="mt-6">
                        <input
                            id="password"
                            type="password"
                            name="password"
                            autoComplete="current-password"
                            ref={passwordInput}
                            value={data.password}
                            onChange={(e) => setData('password', e.target.value)}
                            className="ui-input"
                            autoFocus
                        />
                    </Field>

                    <div className="mt-6 flex flex-wrap gap-2.5">
                        <Button type="submit" variant="danger" disabled={processing}>
                            {processing ? 'A apagar…' : 'Apagar a conta'}
                        </Button>
                        <Button variant="soft" onClick={closeModal}>
                            Cancelar
                        </Button>
                    </div>
                </form>
            </Modal>
        </section>
    );
}
