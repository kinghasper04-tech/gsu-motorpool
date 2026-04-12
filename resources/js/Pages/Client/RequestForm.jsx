import { useState, useEffect } from 'react';
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

    // Frontend-only state
    const [toDate, setToDate] = useState('');
    const [isHalfDay, setIsHalfDay] = useState(false);
    const [isHalfDayFirst, setIsHalfDayFirst] = useState(false);
    const [timeError, setTimeError] = useState('');

    const { data, setData, post, processing, errors, clearErrors } = useForm({
        destination: '',
        purpose: '',
        authorized_passengers: '',
        date_of_travel: '',      // FROM date — sent to backend
        days_of_travel: '',      // auto-calculated decimal — sent to backend
        half_day_period: 'full', // 'morning' | 'afternoon' | 'full' — sent to backend
        time_of_travel: '',
    });

    // ── Derived values ──────────────────────────────────────────────────

    const calcDays = (from, to, halfLast, halfFirst) => {
        if (!from || !to || to < from) return null;
        const msPerDay = 86400000;
        const calDays = (new Date(to) - new Date(from)) / msPerDay + 1;
        return calDays - (halfLast ? 0.5 : 0) - (halfFirst ? 0.5 : 0);
    };

    const days = calcDays(data.date_of_travel, toDate, isHalfDay, isHalfDayFirst);

    // Afternoon only available on last date for same-day (0.5) trips
    const forceMorningOnly = isHalfDay && days !== null && days >= 1.5;

    // Half day on first date only makes sense when 2+ calendar days are selected
    const calendarDays = (data.date_of_travel && toDate)
        ? (new Date(toDate) - new Date(data.date_of_travel)) / 86400000 + 1
        : 0;
    const showHalfDayFirst = calendarDays >= 2;

    // ── Sync calculated days into form data ─────────────────────────────

    useEffect(() => {
        setData('days_of_travel', days !== null ? String(days) : '');
    }, [days]);

    // Keep half_day_period in sync; auto-reset isHalfDayFirst if range shrinks
    useEffect(() => {
        if (!showHalfDayFirst && isHalfDayFirst) {
            setIsHalfDayFirst(false);
        }
        if (!isHalfDay) {
            setData('half_day_period', 'full');
            setTimeError('');
        } else if (forceMorningOnly) {
            setData('half_day_period', 'morning');
            if (data.time_of_travel) {
                validateTime(data.time_of_travel, 'morning', true, isHalfDayFirst);
            }
        }
    }, [isHalfDay, forceMorningOnly, showHalfDayFirst]);

    // ── Time validation ─────────────────────────────────────────────────

    const validateTime = (
        time,
        period,
        halfDay = isHalfDay,
        halfFirst = isHalfDayFirst
    ) => {
        if (!time) {
            setTimeError('');
            return true;
        }

        // 0.5 day trips: restrict based on last-date period
        if (halfDay && days === 0.5) {
            if (period === 'morning' && time >= '12:00') {
                setTimeError('Morning period requires an AM time.');
                return false;
            }
            if (period === 'afternoon' && time < '12:00') {
                setTimeError('Afternoon period requires a PM time.');
                return false;
            }
        }

        // 1.5+ day trips with half day on first date: PM only
        if (halfFirst) {
            if (time < '12:00') {
                setTimeError('Departing on a half day requires a PM time.');
                return false;
            }
        }

        setTimeError('');
        return true;
    };

    const getTimeBounds = () => {
        // Half day on first date always takes precedence — PM only
        if (isHalfDayFirst) return { min: '12:00', max: '23:59' };
        // 0.5 day: restrict by last-date period
        if (!isHalfDay || days !== 0.5) return {};
        if (data.half_day_period === 'morning')   return { min: '00:00', max: '11:59' };
        if (data.half_day_period === 'afternoon') return { min: '12:00', max: '23:59' };
        return {};
    };

    const getTimeHint = () => {
        if (timeError) return null;
        if (isHalfDayFirst) return 'Departing on a half day: any PM time';
        if (!isHalfDay || days !== 0.5) return null;
        if (data.half_day_period === 'morning')   return 'Morning: any AM time';
        if (data.half_day_period === 'afternoon') return 'Afternoon: any PM time';
        return null;
    };

    // ── Handlers ────────────────────────────────────────────────────────

    const handleFromDateChange = (e) => {
        const from = e.target.value;
        setData('date_of_travel', from);
        if (toDate && toDate < from) setToDate(from);
    };

    const handleToDateChange = (e) => setToDate(e.target.value);

    const handleHalfDayChange = (e) => {
        const checked = e.target.checked;
        setIsHalfDay(checked);
        if (checked) {
            setData('half_day_period', 'morning');
            if (data.time_of_travel) validateTime(data.time_of_travel, 'morning', true, isHalfDayFirst);
        }
    };

    const handleHalfDayFirstChange = (e) => {
        const checked = e.target.checked;
        setIsHalfDayFirst(checked);
        if (checked && data.half_day_period === 'afternoon') {
            setData('half_day_period', 'morning');
        }
        validateTime(data.time_of_travel, data.half_day_period, isHalfDay, checked);
    };

    const handlePeriodChange = (e) => {
        const period = e.target.value;
        setData('half_day_period', period);
        validateTime(data.time_of_travel, period, isHalfDay, isHalfDayFirst);
    };

    const handlePassengersChange = (newPassengers) => {
        setPassengers(newPassengers);
        setData('authorized_passengers', newPassengers.join(', '));
    };

    const handleTimeChange = (e) => {
        const time = e.target.value;
        setData('time_of_travel', time);
        validateTime(time, data.half_day_period, isHalfDay, isHalfDayFirst);
    };

    // ── Days display label ───────────────────────────────────────────────

    const getDaysLabel = () => {
        if (days === null) return null;
        const unit = days === 1 ? 'day' : 'days';
        const parts = [];
        if (isHalfDayFirst) parts.push('Afternoon start');
        if (isHalfDay) {
            const activePeriod = forceMorningOnly ? 'morning' : data.half_day_period;
            parts.push(activePeriod === 'afternoon' ? 'Afternoon end' : 'Morning end');
        }
        const suffix = parts.length ? ` (${parts.join(', ')})` : '';
        return `${days} ${unit}${suffix}`;
    };

    // ── Preview / Submit ─────────────────────────────────────────────────

    const handlePreview = async (e) => {
        e.preventDefault();
        clearErrors();

        if (!toDate) {
            alert('Please select a "To" date.');
            return;
        }

        const requiredFields = [
            'destination',
            'purpose',
            'authorized_passengers',
            'date_of_travel',
            'days_of_travel',
            'time_of_travel',
        ];

        if (requiredFields.some((f) => !data[f])) {
            alert('Please fill in all required fields before previewing.');
            return;
        }

        if (isHalfDay && (!data.half_day_period || data.half_day_period === 'full')) {
            alert('Please select Morning or Afternoon for the half-day period.');
            return;
        }

        if (timeError) {
            alert('Please fix the time of departure before previewing.');
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
            onError: (errs) => {
                setIsPreviewModalOpen(false);
                console.error('Submission errors:', errs);
            },
        });
    };

    const closePreviewModal = () => {
        setIsPreviewModalOpen(false);
        setPreviewUrl('');
    };

    const today      = new Date().toISOString().split('T')[0];
    const timeBounds = getTimeBounds();
    const daysLabel  = getDaysLabel();
    const timeHint   = getTimeHint();

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

                                {/* Date of Travel — From / To */}
                                <div>
                                    <InputLabel>
                                        Date of Travel <span className="text-red-500">*</span>
                                    </InputLabel>
                                    <div className="mt-1 flex items-center gap-2">
                                        <div className="flex-1">
                                            <span className="text-xs text-gray-500 mb-1 block">From</span>
                                            <TextInput
                                                type="date"
                                                value={data.date_of_travel}
                                                onChange={handleFromDateChange}
                                                className="block w-full"
                                                min={today}
                                                required
                                            />
                                        </div>
                                        <span className="text-gray-400 mt-4">—</span>
                                        <div className="flex-1">
                                            <span className="text-xs text-gray-500 mb-1 block">To</span>
                                            <TextInput
                                                type="date"
                                                value={toDate}
                                                onChange={handleToDateChange}
                                                className="block w-full"
                                                min={data.date_of_travel || today}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <InputError message={errors.date_of_travel} />
                                </div>

                                {/* Half day on first date — only for 2+ calendar day trips */}
                                {showHalfDayFirst && (
                                    <div>
                                        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={isHalfDayFirst}
                                                onChange={handleHalfDayFirstChange}
                                                className="rounded border-gray-300 text-indigo-600 shadow-sm focus:ring-indigo-500"
                                            />
                                            <span className="text-sm text-gray-700">Half day on first date</span>
                                        </label>
                                        {isHalfDayFirst && (
                                            <p className="text-xs text-gray-400 mt-1 ml-1">
                                                Departure is in the afternoon — time of departure restricted to PM.
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* Half day on last date */}
                                <div>
                                    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={isHalfDay}
                                            onChange={handleHalfDayChange}
                                            className="rounded border-gray-300 text-indigo-600 shadow-sm focus:ring-indigo-500"
                                        />
                                        <span className="text-sm text-gray-700">Half day on last date</span>
                                    </label>

                                    {isHalfDay && (
                                        <div className="mt-2 ml-1 flex items-center gap-6">
                                            <label className="inline-flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="half_day_period"
                                                    value="morning"
                                                    checked={data.half_day_period === 'morning'}
                                                    onChange={handlePeriodChange}
                                                    className="border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                    required
                                                />
                                                <span className="text-sm text-gray-700">Morning (until 12 PM)</span>
                                            </label>

                                            {/* Afternoon only for same-day half day (0.5 days) */}
                                            {!forceMorningOnly && (
                                                <label className="inline-flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="half_day_period"
                                                        value="afternoon"
                                                        checked={data.half_day_period === 'afternoon'}
                                                        onChange={handlePeriodChange}
                                                        className="border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                        disabled={isHalfDayFirst}
                                                        required
                                                    />
                                                    <span className="text-sm text-gray-700">Afternoon (until 5 PM)</span>
                                                </label>
                                            )}
                                        </div>
                                    )}

                                    {isHalfDay && forceMorningOnly && (
                                        <p className="text-xs text-gray-400 mt-1 ml-1">
                                            Only morning is available for trips longer than 1 day.
                                        </p>
                                    )}

                                    <InputError message={errors.half_day_period} />
                                </div>

                                {/* Days of Travel — read only */}
                                <div>
                                    <InputLabel>Days of Travel</InputLabel>
                                    <div className="mt-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm min-h-[38px] flex items-center">
                                        {daysLabel
                                            ? <span className="text-gray-800 font-medium">{daysLabel}</span>
                                            : <span className="text-gray-400">Auto-calculated from selected dates</span>
                                        }
                                    </div>
                                    <InputError message={errors.days_of_travel} />
                                </div>

                                {/* Time of Departure */}
                                <div>
                                    <InputLabel htmlFor="time_of_travel">
                                        Time of Departure <span className="text-red-500">*</span>
                                    </InputLabel>
                                    <TextInput
                                        id="time_of_travel"
                                        type="time"
                                        value={data.time_of_travel}
                                        onChange={handleTimeChange}
                                        className="mt-1 block w-full"
                                        min={timeBounds.min}
                                        max={timeBounds.max}
                                        required
                                    />
                                    {timeHint && (
                                        <p className="text-xs text-gray-500 mt-1">{timeHint}</p>
                                    )}
                                    {timeError && (
                                        <p className="text-sm text-red-600 mt-1">{timeError}</p>
                                    )}
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