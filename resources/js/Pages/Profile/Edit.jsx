import StudentLayout from '@/Layouts/StudentLayout';
import { Head } from '@inertiajs/react';
import DeleteUserForm from './Partials/DeleteUserForm';
import UpdatePasswordForm from './Partials/UpdatePasswordForm';
import UpdateProfileInformationForm from './Partials/UpdateProfileInformationForm';

export default function Edit({ mustVerifyEmail, status }) {
    return (
        <StudentLayout>
            <Head title="Perfil" />

            <p className="mb-6 text-lg font-bold sm:text-xl">O teu perfil</p>

            <div className="mx-auto max-w-3xl space-y-6">
                <div className="ta-glass rounded-2xl p-6">
                    <UpdateProfileInformationForm
                        mustVerifyEmail={mustVerifyEmail}
                        status={status}
                        className="max-w-xl"
                    />
                </div>

                <div className="ta-glass rounded-2xl p-6">
                    <UpdatePasswordForm className="max-w-xl" />
                </div>

                <div className="ta-glass rounded-2xl p-6">
                    <DeleteUserForm className="max-w-xl" />
                </div>
            </div>
        </StudentLayout>
    );
}
