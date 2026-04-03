import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import { Transition } from '@headlessui/react';
import { Link, useForm, usePage } from '@inertiajs/react';

export default function UpdateProfileInformationForm({
    mustVerifyEmail,
    status,
    className = '',
}) {
    const user = usePage().props.auth.user;

    const { data, setData, patch, errors, processing, recentlySuccessful } =
        useForm({
            name: user.name,
            email: user.email,
            department: user.department ?? '',
            position: user.position ?? '',
        });

    const submit = (e) => {
        e.preventDefault();
        patch(route('profile.update'));
    };

    const getRoleBadge = (role) => {
        const map = {
            client: { label: 'Client', classes: 'bg-blue-50 text-blue-700 border-blue-200' },
            approval_admin: { label: 'Approval Admin', classes: 'bg-purple-50 text-purple-700 border-purple-200' },
            assignment_admin: { label: 'Assignment Admin', classes: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
            ticket_admin: { label: 'Ticket Admin', classes: 'bg-teal-50 text-teal-700 border-teal-200' },
        };
        return map[role] ?? { label: role, classes: 'bg-gray-50 text-gray-600 border-gray-200' };
    };

    const getStatusBadge = (status) => {
        return status === 'approved'
            ? { label: 'Approved', classes: 'bg-green-50 text-green-700 border-green-200' }
            : { label: 'Pending', classes: 'bg-amber-50 text-amber-700 border-amber-200' };
    };

    const getInitials = (name) => {
        if (!name) return '?';
        return name
            .split(' ')
            .slice(0, 2)
            .map((n) => n[0])
            .join('')
            .toUpperCase();
    };

    const roleBadge = getRoleBadge(user.role);

    return (
        <section className={className}>
            {/* Profile summary card header */}
            <div className="mb-6 flex items-center gap-4 border-b border-gray-200 pb-6">
                {/* Avatar */}
                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-base font-semibold text-blue-800">
                    {getInitials(user.name)}
                </div>

                <div>
                    <p className="text-base font-semibold text-gray-900">
                        {user.name}
                    </p>
                    <p className="mt-0.5 text-sm text-gray-500">
                        {user.department || 'No department set'}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <span
                            className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${roleBadge.classes}`}
                        >
                            {roleBadge.label}
                        </span>
                    </div>
                </div>
            </div>

            <header className="mb-5">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                    Account Information
                </h2>
            </header>

            <form onSubmit={submit} className="space-y-5">
                {/* Name & Email row */}
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div>
                        <InputLabel
                            htmlFor="name"
                            value="Full Name"
                            className="text-xs font-medium uppercase tracking-wide text-gray-500"
                        />
                        <TextInput
                            id="name"
                            className="mt-1 block w-full"
                            value={data.name}
                            onChange={(e) => setData('name', e.target.value)}
                            required
                            isFocused
                            autoComplete="name"
                        />
                        <InputError className="mt-1.5" message={errors.name} />
                    </div>

                    <div>
                        <InputLabel
                            htmlFor="email"
                            value="Email Address"
                            className="text-xs font-medium uppercase tracking-wide text-gray-500"
                        />
                        <TextInput
                            id="email"
                            type="email"
                            className="mt-1 block w-full"
                            value={data.email}
                            onChange={(e) => setData('email', e.target.value)}
                            required
                            autoComplete="username"
                        />
                        <InputError className="mt-1.5" message={errors.email} />
                    </div>
                </div>

                {/* Department & Position row */}
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div>
                        <InputLabel
                            htmlFor="department"
                            value="Department"
                            className="text-xs font-medium uppercase tracking-wide text-gray-500"
                        />
                        <TextInput
                            id="department"
                            className="mt-1 block w-full"
                            value={data.department}
                            onChange={(e) =>
                                setData('department', e.target.value)
                            }
                            required
                            autoComplete="organization"
                        />
                        <InputError
                            className="mt-1.5"
                            message={errors.department}
                        />
                    </div>

                    <div>
                        <InputLabel
                            htmlFor="position"
                            value="Position / Designation"
                            className="text-xs font-medium uppercase tracking-wide text-gray-500"
                        />
                        <TextInput
                            id="position"
                            className="mt-1 block w-full"
                            value={data.position}
                            onChange={(e) =>
                                setData('position', e.target.value)
                            }
                            required
                            autoComplete="organization-title"
                        />
                        <InputError
                            className="mt-1.5"
                            message={errors.position}
                        />
                    </div>
                </div>

                {/* Read-only role & status */}
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div>
                        <InputLabel
                            htmlFor="role_display"
                            value="Role"
                            className="text-xs font-medium uppercase tracking-wide text-gray-500"
                        />
                        <input
                            id="role_display"
                            type="text"
                            value={roleBadge.label}
                            disabled
                            className="mt-1 block w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500 shadow-sm"
                        />
                        <p className="mt-1 text-xs text-gray-400">
                            Role is managed by an administrator.
                        </p>
                    </div>
                </div>

                {/* Email verification notice */}
                {mustVerifyEmail && user.email_verified_at === null && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
                        <p className="text-sm text-amber-800">
                            Your email address is unverified.{' '}
                            <Link
                                href={route('verification.send')}
                                method="post"
                                as="button"
                                className="font-medium underline hover:text-amber-900"
                            >
                                Re-send verification email.
                            </Link>
                        </p>

                        {status === 'verification-link-sent' && (
                            <p className="mt-1.5 text-sm font-medium text-green-700">
                                A new verification link has been sent to your
                                email address.
                            </p>
                        )}
                    </div>
                )}

                {/* Submit row */}
                <div className="flex items-center gap-4 border-t border-gray-100 pt-5">
                    <PrimaryButton disabled={processing}>
                        Save Changes
                    </PrimaryButton>

                    <Transition
                        show={recentlySuccessful}
                        enter="transition ease-in-out duration-300"
                        enterFrom="opacity-0"
                        leave="transition ease-in-out duration-300"
                        leaveTo="opacity-0"
                    >
                        <p className="text-sm text-green-600">Saved.</p>
                    </Transition>
                </div>
            </form>
        </section>
    );
}