import StudentLayout from '@/Layouts/StudentLayout';
import { Head } from '@inertiajs/react';
import DeleteUserForm from './Partials/DeleteUserForm';
import UpdatePasswordForm from './Partials/UpdatePasswordForm';
import UpdateProfileInformationForm from './Partials/UpdateProfileInformationForm';

export default function Edit({ mustVerifyEmail, status }) {
    return (
        <StudentLayout>
            <Head title="Perfil" />

            <h1 className="mx-auto mb-6 max-w-3xl font-display text-[26px] font-bold uppercase">O teu perfil</h1>

            <div className="mx-auto max-w-3xl space-y-6">
                <div className="ta-cut-16 bg-surface p-6">
                    <UpdateProfileInformationForm
                        mustVerifyEmail={mustVerifyEmail}
                        status={status}
                        className="max-w-xl"
                    />
                </div>

                <div className="ta-cut-16 bg-surface p-6">
                    <UpdatePasswordForm className="max-w-xl" />
                </div>

                <div className="ta-cut-16 bg-surface p-6">
                    <DeleteUserForm className="max-w-xl" />
                </div>
            </div>
        </StudentLayout>
    );
}
