import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import DeleteUserForm from './Partials/DeleteUserForm';
import UpdatePasswordForm from './Partials/UpdatePasswordForm';
import UpdateProfileInformationForm from './Partials/UpdateProfileInformationForm';

export default function Edit({ mustVerifyEmail, status }) {
    return (
        <AuthenticatedLayout
            header={
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">My Profile</h2>
                    </div>
                </div>
            }
        >
            <Head title="Profile" />

            
                

                    {/* Profile Information */}
                    <div className="overflow-hidden bg-white shadow-sm ring-1 ring-gray-100 sm:rounded-lg">
                        <div className="p-6 sm:p-8">
                            <UpdateProfileInformationForm
                                mustVerifyEmail={mustVerifyEmail}
                                status={status}
                            />
                        </div>
                    </div>

                    {/* Update Password */}
                    <div className="overflow-hidden bg-white shadow-sm ring-1 ring-gray-100 sm:rounded-lg">
                        <div className="p-6 sm:p-8">
                            <UpdatePasswordForm />
                        </div>
                    </div>

                    {/* Delete Account */}
                    <div className="overflow-hidden bg-white shadow-sm ring-1 ring-red-100 sm:rounded-lg">
                        <div className="p-6 sm:p-8">
                            <DeleteUserForm />
                        </div>
                    </div>

                
            
        </AuthenticatedLayout>
    );
}