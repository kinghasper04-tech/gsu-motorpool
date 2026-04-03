import { useState } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm, router, usePage } from '@inertiajs/react';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import InputError from '@/Components/InputError';
import RequestPreviewModal from '@/Components/RequestPreviewModal';
import AuthorizedPassengersInput from '@/Components/AuthorizedPassengersInput';

export default function RequestForm() {
    const { auth } = usePage().props;
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
    const [previewUrl, setPreviewUrl] = useState('');
    const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);

    const [passengers, setPassengers] = useState([]);

    const { data, setData, post, processing, errors, clearErrors } = useForm({
        destination: '',
        purpose: '',
        authorized_passengers: '',
        date_of_travel: '',
        days_of_travel: '',
        half_day_period: '',
        time_of_travel: '',
    });

    const handlePassengersChange = (newPassengers) => {
        setPassengers(newPassengers);
        setData('authorized_passengers', newPassengers.join(', '));
    };

    const requiresHalfDayPeriod = () => {
        const days = parseFloat(data.days_of_travel);
        return !isNaN(days) && days % 1 !== 0;
    };

    const handleDaysChange = (e) => {
        const value = e.target.value;
        setData('days_of_travel', value);
        const days = parseFloat(value);
        if (!isNaN(days) && days % 1 === 0) {
            setData('half_day_period', '');
        }
    };

    const handlePreview = async (e) => {
        e.preventDefault();
        clearErrors();

        const requiredFields = [
            'destination',
            'purpose',
            'authorized_passengers',
            'date_of_travel',
            'days_of_travel',
            'time_of_travel',
        ];

        const missingFields = requiredFields.filter((field) => !data[field]);

        if (missingFields.length > 0) {
            alert('Please fill in all required fields before previewing.');
            return;
        }

        if (requiresHalfDayPeriod() && !data.half_day_period) {
            alert('Please select morning or afternoon for half-day requests.');
            return;
        }

        setIsGeneratingPreview(true);

        try {
            const params = new URLSearchParams();
            Object.keys(data).forEach((key) => {
                if (data[key]) params.append(key, data[key]);
            });
            setPreviewUrl(`/request/preview?${params.toString()}`);
            setIsPreviewModalOpen(true);
        } catch (error) {
            console.error('Error generating preview:', error);
            alert('Failed to generate preview. Please try again.');
        } finally {
            setIsGeneratingPreview(false);
        }
    };

    const handleConfirmSubmit = () => {
        post('/request', {
            onSuccess: () => setIsPreviewModalOpen(false),
            onError: (errors) => {
                setIsPreviewModalOpen(false);
                console.error('Submission errors:', errors);
            },
        });
    };

    const closePreviewModal = () => {
        setIsPreviewModalOpen(false);
        setPreviewUrl('');
    };

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold leading-tight text-gray-800">
                    Request Vehicle
                </h2>
            }
        >
            <Head title="Request Vehicle" />

            <div className="py-2 px-4 sm:px-6 lg:px-8">
                <div className="mx-auto w-full max-w-8xl bg-white shadow rounded-xl p-6">
                    <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">
                        REQUEST FOR USE OF VEHICLE
                    </h1>

                    <form onSubmit={handlePreview}>
                        <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-8 gap-y-0">

                            {/* ── LEFT COLUMN ── */}
                            <div className="space-y-4">

                                {/* Destination */}
                                <div>
                                    <InputLabel htmlFor="destination">
                                        Destination <span className="text-red-500">*</span>
                                    </InputLabel>
                                    <TextInput
                                        id="destination"
                                        value={data.destination}
                                        onChange={(e) => setData('destination', e.target.value)}
                                        className="mt-1 block w-full"
                                        required
                                    />
                                    <InputError message={errors.destination} />
                                </div>

                                {/* Purpose */}
                                <div>
                                    <InputLabel htmlFor="purpose">
                                        Purpose <span className="text-red-500">*</span>
                                    </InputLabel>
                                    <textarea
                                        id="purpose"
                                        value={data.purpose}
                                        onChange={(e) => setData('purpose', e.target.value)}
                                        className="mt-1 block w-full border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-md shadow-sm"
                                        rows="4"
                                        required
                                    />
                                    <InputError message={errors.purpose} />
                                </div>

                                {/* Authorized Passengers */}
                                <AuthorizedPassengersInput
                                    passengers={passengers}
                                    onChange={handlePassengersChange}
                                    error={errors.authorized_passengers}
                                />
                            </div>

                            {/* ── RIGHT COLUMN ── */}
                            <div className="space-y-4 mt-6 md:mt-0">

                                {/* Date of Travel */}
                                <div>
                                    <InputLabel htmlFor="date_of_travel">
                                        Date of Travel <span className="text-red-500">*</span>
                                    </InputLabel>
                                    <TextInput
                                        id="date_of_travel"
                                        type="date"
                                        value={data.date_of_travel}
                                        onChange={(e) => setData('date_of_travel', e.target.value)}
                                        className="mt-1 block w-full"
                                        min={new Date().toISOString().split('T')[0]}
                                        required
                                    />
                                    <InputError message={errors.date_of_travel} />
                                </div>

                                {/* Days of Travel */}
                                <div>
                                    <InputLabel htmlFor="days_of_travel">
                                        Days of Travel <span className="text-red-500">*</span>
                                    </InputLabel>
                                    <TextInput
                                        id="days_of_travel"
                                        type="number"
                                        step="0.5"
                                        min="0.5"
                                        value={data.days_of_travel}
                                        onChange={handleDaysChange}
                                        className="mt-1 block w-full"
                                        required
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Enter 0.5 for half-day, 1 for full day, 1.5 for day and a half, etc.
                                    </p>
                                    <InputError message={errors.days_of_travel} />
                                </div>

                                {/* Half-Day Period (conditional) */}
                                {requiresHalfDayPeriod() && (
                                    <div>
                                        <InputLabel htmlFor="half_day_period">
                                            Half-Day Period <span className="text-red-500">*</span>
                                        </InputLabel>
                                        <select
                                            id="half_day_period"
                                            value={data.half_day_period}
                                            onChange={(e) => setData('half_day_period', e.target.value)}
                                            className="mt-1 block w-full border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-md shadow-sm"
                                            required
                                        >
                                            <option value="">Select Period</option>
                                            <option value="morning">Morning (until 12 PM)</option>
                                            <option value="afternoon">Afternoon (until 5 PM)</option>
                                        </select>
                                        <InputError message={errors.half_day_period} />
                                    </div>
                                )}

                                {/* Time of Travel */}
                                <div>
                                    <InputLabel htmlFor="time_of_travel">
                                        Time of Travel <span className="text-red-500">*</span>
                                    </InputLabel>
                                    <TextInput
                                        id="time_of_travel"
                                        type="time"
                                        value={data.time_of_travel}
                                        onChange={(e) => setData('time_of_travel', e.target.value)}
                                        className="mt-1 block w-full"
                                        required
                                    />
                                    <InputError message={errors.time_of_travel} />
                                </div>
                            </div>
                        </div>

                        {/* Note */}
                        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-md p-4">
                            <p className="text-sm text-blue-800">
                                <strong>Note:</strong> After clicking "Preview Request", you'll be able to review
                                your request form before final submission.
                            </p>
                        </div>

                        {/* Buttons */}
                        <div className="flex justify-end gap-4 pt-4">
                            <button
                                type="button"
                                onClick={() => router.visit(route('dashboard'))}
                                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                                disabled={isGeneratingPreview || processing}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                                disabled={isGeneratingPreview || processing}
                            >
                                {isGeneratingPreview ? 'Generating Preview...' : 'Preview Request'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <RequestPreviewModal
                isOpen={isPreviewModalOpen}
                closeModal={closePreviewModal}
                formData={data}
                user={auth.user}
                onConfirmSubmit={handleConfirmSubmit}
                submitting={processing}
                previewUrl={previewUrl}
            />
        </AuthenticatedLayout>
    );
}