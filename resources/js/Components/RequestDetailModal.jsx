import { X, MapPin, Calendar, Clock, Users, Car, User, FileText, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export default function RequestDetailModal({ isOpen, onClose, request }) {
    if (!isOpen || !request) return null;

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
    };

    const formatTime = (timeString) => {
        const [hours, minutes] = timeString.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12;
        return `${hour12}:${minutes} ${ampm}`;
    };

    const formatDateTime = (dateString) => {
        const date = new Date(dateString);
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const hour12 = hours % 12 || 12;
        const minuteStr = minutes < 10 ? '0' + minutes : minutes;
        return `${hour12}:${minuteStr} ${ampm}`;
    };

    const getStatusSteps = () => {
        return [
            { 
                id: 'pending', 
                label: 'Pending', 
                icon: AlertCircle,
                description: 'Request submitted'
            },
            { 
                id: 'assigned', 
                label: 'Assigned', 
                icon: Car,
                description: 'Vehicle & driver assigned'
            },
            { 
                id: 'approved', 
                label: 'Approved', 
                icon: CheckCircle,
                description: 'Request approved'
            },
            { 
                id: 'completed', 
                label: 'Completed', 
                icon: CheckCircle,
                description: 'Trip completed'
            }
        ];
    };

    const getDeclinedSteps = () => {
        return [
            { 
                id: 'pending', 
                label: 'Pending', 
                icon: AlertCircle,
                description: 'Request submitted'
            },
            { 
                id: 'declined', 
                label: 'Declined', 
                icon: XCircle,
                description: 'Request declined'
            }
        ];
    };

    const getCancelledSteps = () => {
        return [
            { 
                id: 'pending', 
                label: 'Pending', 
                icon: AlertCircle,
                description: 'Request submitted'
            },
            { 
                id: 'cancelled', 
                label: 'Cancelled', 
                icon: XCircle,
                description: 'Request cancelled'
            }
        ];
    };

    const getCurrentStepIndex = () => {
        const statusOrder = ['pending', 'assigned', 'approved', 'completed'];
        return statusOrder.indexOf(request.status);
    };

    const getStepStatus = (stepId, index) => {
        if (request.status === 'declined') {
            if (stepId === 'pending') return 'completed';
            if (stepId === 'declined') return 'current';
            return 'upcoming';
        }

        if (request.status === 'cancelled') {
            if (stepId === 'pending') return 'completed';
            if (stepId === 'cancelled') return 'current';
            return 'upcoming';
        }

        const currentIndex = getCurrentStepIndex();
        if (index < currentIndex) return 'completed';
        if (index === currentIndex) return 'current';
        return 'upcoming';
    };

    const steps = request.status === 'declined' 
        ? getDeclinedSteps() 
        : request.status === 'cancelled'
        ? getCancelledSteps()
        : getStatusSteps();

    const ProgressBar = () => (
        <div className="relative">
            {/* Progress Line */}
            <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200" style={{ zIndex: 0 }}>
                <div 
                    className={`h-full transition-all duration-500 ${
                        request.status === 'declined' ? 'bg-red-500' : request.status === 'cancelled' ? 'bg-gray-400' : 'bg-green-500'
                    }`}
                    style={{ 
                        width: request.status === 'declined' || request.status === 'cancelled'
                            ? '50%' 
                            : `${(getCurrentStepIndex() / (steps.length - 1)) * 100}%` 
                    }}
                />
            </div>

            {/* Steps */}
            <div className="relative flex justify-between" style={{ zIndex: 1 }}>
                {steps.map((step, index) => {
                    const status = getStepStatus(step.id, index);
                    const Icon = step.icon;

                    return (
                        <div key={step.id} className="flex flex-col items-center" style={{ flex: 1 }}>
                            {/* Circle */}
                            <div
                                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                                    status === 'completed'
                                        ? request.status === 'declined'
                                            ? 'bg-red-500 border-red-500'
                                            : request.status === 'cancelled'
                                            ? 'bg-gray-400 border-gray-400'
                                            : 'bg-green-500 border-green-500'
                                        : status === 'current'
                                        ? request.status === 'declined'
                                            ? 'bg-red-500 border-red-500 ring-4 ring-red-100'
                                            : request.status === 'cancelled'
                                            ? 'bg-gray-400 border-gray-400 ring-4 ring-gray-100'
                                            : 'bg-blue-500 border-blue-500 ring-4 ring-blue-100'
                                        : 'bg-white border-gray-300'
                                }`}
                            >
                                <Icon
                                    className={`w-5 h-5 ${
                                        status === 'completed' || status === 'current'
                                            ? 'text-white'
                                            : 'text-gray-400'
                                    }`}
                                />
                            </div>

                            {/* Label */}
                            <div className="mt-2 text-center">
                                <p
                                    className={`text-sm font-medium ${
                                        status === 'completed' || status === 'current'
                                            ? 'text-gray-900'
                                            : 'text-gray-400'
                                    }`}
                                >
                                    {step.label}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                    {step.description}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto" onClick={onClose}>
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                {/* Background overlay */}
                <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" />

                {/* Modal panel */}
                <div
                    className="inline-block w-full max-w-4xl my-8 overflow-hidden text-left align-middle transition-all transform bg-white rounded-lg shadow-xl"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                                    <FileText className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white">
                                        Request Details
                                    </h3>
                                    <p className="text-sm text-blue-100">
                                        Request ID: #{request.id}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="px-6 py-6 max-h-[calc(100vh-200px)] overflow-y-auto">
                        {/* Progress Tracker */}
                        <div className="mb-8 bg-gray-50 rounded-xl p-6">
                            <h4 className="text-lg font-semibold text-gray-900 mb-6">Request Progress</h4>
                            <ProgressBar />
                        </div>

                        {/* Request Information */}
                        <div className="space-y-6">
                            {/* Basic Details */}
                            <div className="bg-white border border-gray-200 rounded-xl p-6">
                                <h4 className="text-lg font-semibold text-gray-900 mb-4">Trip Information</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        <div className="flex items-start space-x-3">
                                            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                                                <MapPin className="w-5 h-5 text-blue-600" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm text-gray-500 mb-1">Destination</p>
                                                <p className="font-medium text-gray-900">{request.destination}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-start space-x-3">
                                            <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center flex-shrink-0">
                                                <FileText className="w-5 h-5 text-purple-600" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm text-gray-500 mb-1">Purpose</p>
                                                <p className="font-medium text-gray-900">{request.purpose}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-start space-x-3">
                                            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
                                                <Users className="w-5 h-5 text-green-600" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm text-gray-500 mb-1">Authorized Passengers</p>
                                                <p className="font-medium text-gray-900">{request.authorized_passengers}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex items-start space-x-3">
                                            <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center flex-shrink-0">
                                                <Calendar className="w-5 h-5 text-orange-600" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm text-gray-500 mb-1">Date of Travel</p>
                                                <p className="font-medium text-gray-900">{formatDate(request.date_of_travel)}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-start space-x-3">
                                            <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0">
                                                <Clock className="w-5 h-5 text-amber-600" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm text-gray-500 mb-1">Time of Travel</p>
                                                <p className="font-medium text-gray-900">{formatTime(request.time_of_travel)}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-start space-x-3">
                                            <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0">
                                                <Calendar className="w-5 h-5 text-indigo-600" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm text-gray-500 mb-1">Duration</p>
                                                <p className="font-medium text-gray-900">{request.days_of_travel} {request.days_of_travel === 1 ? 'Day' : 'Days'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Assignment Details */}
                            {(request.status === 'assigned' || request.status === 'approved' || request.status === 'completed') && (
                                <div className="bg-white border border-gray-200 rounded-xl p-6">
                                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Assignment Details</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="flex items-start space-x-3">
                                            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                                                <Car className="w-5 h-5 text-blue-600" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm text-gray-500 mb-1">Assigned Vehicle</p>
                                                <p className="font-medium text-gray-900">
                                                    {request.vehicle 
                                                        ? `${request.vehicle.description} (${request.vehicle.plate_number})`
                                                        : 'Not assigned yet'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-start space-x-3">
                                            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
                                                <User className="w-5 h-5 text-green-600" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm text-gray-500 mb-1">Assigned Driver</p>
                                                <p className="font-medium text-gray-900">
                                                    {request.driver 
                                                        ? request.driver.name
                                                        : 'Not assigned yet'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Decline Reason */}
                            {request.status === 'declined' && request.decline_reason && (
                                <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                                    <div className="flex items-start space-x-3">
                                        <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                                        <div className="flex-1">
                                            <h4 className="text-lg font-semibold text-red-900 mb-2">Decline Reason</h4>
                                            <p className="text-red-800">{request.decline_reason}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Timestamps */}
                            <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
                                <h4 className="text-lg font-semibold text-gray-900 mb-4">Timeline</h4>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-600">Submitted</span>
                                        <span className="text-sm font-medium text-gray-900">
                                            {formatDate(request.created_at)} at {formatDateTime(request.created_at)}
                                        </span>
                                    </div>
                                    {request.approved_at && (
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-gray-600">Approved</span>
                                            <span className="text-sm font-medium text-gray-900">
                                                {formatDate(request.approved_at)} at {formatDateTime(request.approved_at)}
                                            </span>
                                        </div>
                                    )}
                                    {request.declined_at && (
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-gray-600">Declined</span>
                                            <span className="text-sm font-medium text-gray-900">
                                                {formatDate(request.declined_at)} at {formatDateTime(request.declined_at)}
                                            </span>
                                        </div>
                                    )}
                                    {request.cancelled_at && (
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-gray-600">Cancelled</span>
                                            <span className="text-sm font-medium text-gray-900">
                                                {formatDate(request.cancelled_at)} at {formatDateTime(request.cancelled_at)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors"
                            >
                                Close
                            </button>
                            {(request.status === 'approved' || request.status === 'completed' || request.status === 'declined') && (
                                <a
                                    href={`/requests/${request.id}/pdf/preview`}
                                    target="_blank"
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                                >
                                    <FileText className="w-4 h-4" />
                                    View PDF
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}