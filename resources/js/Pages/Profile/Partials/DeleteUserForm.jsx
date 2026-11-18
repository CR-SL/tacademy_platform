import Modal from '@/Components/Modal';
import { Button, Field } from '@/Components/ui';
import { useForm } from '@inertiajs/react';
import { useRef, useState } from 'react';

import { t } from '@/i18n';

// Apagar a conta (RGPD): apaga os dados pessoais de vez. Pede a palavra-passe numa janela de confirmação, porque
// não se pode desfazer. Só alunos; os outros perfis pedem à administração (têm cursos e trabalho ligados à conta).
export default function DeleteUserForm({ className = '', canErase = true }) {
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
                <h2 className="font-display text-lg font-bold text-ink">{t('Apagar a conta')}</h2>
                <p className="mt-1 text-sm text-muted">
                    {t('Apagamos o teu nome, o email, o progresso, as notas, as mensagens, as conversas com o Alex e os certificados. Só os registos das compras ficam guardados, porque a lei obriga a guardar a faturação. Isto não se pode desfazer.')}
                </p>
            </header>

            {canErase ? (
                <Button variant="danger" onClick={() => setConfirmingUserDeletion(true)}>
                    {t('Apagar a conta')}
                </Button>
            ) : (
                <p className="text-sm text-text">{t('Para apagar esta conta, fala com a administração.')}</p>
            )}

            <Modal show={confirmingUserDeletion} onClose={closeModal} maxWidth="md">
                <form onSubmit={deleteUser} className="p-6">
                    <h2 className="font-display text-xl font-extrabold leading-tight">{t('Apagar a tua conta?')}</h2>
                    <p className="mt-2 text-text">
                        {t('Apagamos o teu nome, o email, o progresso, as notas, as mensagens, as conversas com o Alex e os certificados. Só os registos das compras ficam guardados, porque a lei obriga a guardar a faturação. Isto não se pode desfazer.')}
                    </p>

                    <p className="mt-3 bg-page p-3 text-sm text-text">
                        {t('Antes de continuar, descarrega os teus certificados em')}{' '}
                        <a className="ui-link" href="/plataforma/certificados" target="_blank" rel="noopener noreferrer">{t('Certificados')}</a>.{' '}
                        {t('Depois de apagares a conta, deixam de ser válidos.')}
                    </p>

                    <Field id="delete-password" label={t('Palavra-passe')} hint={t('Escreve a tua palavra-passe para confirmar.')} error={errors.password} className="mt-6">
                        <input
                            id="delete-password"
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
                            {processing ? t('A apagar…') : t('Apagar a conta')}
                        </Button>
                        <Button variant="soft" onClick={closeModal}>
                            {t('Cancelar')}
                        </Button>
                    </div>
                </form>
            </Modal>
        </section>
    );
}
