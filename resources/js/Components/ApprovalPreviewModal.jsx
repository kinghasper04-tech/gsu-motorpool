import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

export default function ApprovalPreviewModal({ 
    isOpen, 
    closeModal, 
    request,
    action, // 'approve' or 'decline'
    declineReason,
    approvalAdmin,
    onConfirm, 
    processing,
    previewUrl 
}) {
    if (!request) return null;

    const formatDate = (date) => {
        try {
            return format(new Date(date), 'MMMM d, yyyy');
        } catch {
            return date;
        }
    };

    const formatDateTime = (dateTime) => {
        try {
            return format(new Date(dateTime), 'MMMM d, yyyy h:mm a');
        } catch {
            return dateTime;
        }
    };

    const isApprove = action === 'approve';
    const actionColor = isApprove ? 'green' : 'red';
    const actionText = isApprove ? 'Approve' : 'Decline';
    const ActionIcon = isApprove ? CheckCircle : XCircle;

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={closeModal}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/25" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <Dialog.Panel className="w-full max-w-5xl transform overflow-hidden rounded-lg bg-white shadow-xl transition-all">
                            <Dialog.Title as="div" className={`flex items-center justify-between border-b p-4 ${
                                isApprove ? 'bg-green-50' : 'bg-red-50'
                            }`}>
                                <div className="flex items-center gap-2">
                                    <ActionIcon className={`w-5 h-5 ${
                                        isApprove ? 'text-green-600' : 'text-red-600'
                                    }`} />
                                    <h3 className="text-lg font-medium">
                                        {actionText} Request Preview
                                    </h3>
                                </div>
                                <button 
                                    onClick={closeModal} 
                                    className="text-gray-400 hover:text-gray-500"
                                    disabled={processing}
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </Dialog.Title>

                            <div className="p-6">
                                {/* Decision Summary */}
                                <div className={`border-2 rounded-lg p-6 mb-6 ${
                                    isApprove 
                                        ? 'border-green-200 bg-green-50' 
                                        : 'border-red-200 bg-red-50'
                                }`}>
                                    <div className="text-center mb-4">
                                        <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full ${
                                            isApprove ? 'bg-green-100' : 'bg-red-100'
                                        } mb-3`}>
                                            <ActionIcon className={`w-8 h-8 ${
                                                isApprove ? 'text-green-600' : 'text-red-600'
                                            }`} />
                                        </div>
                                        <h2 className={`text-2xl font-bold ${
                                            isApprove ? 'text-green-900' : 'text-red-900'
                                        }`}>
                                            REQUEST WILL BE {actionText.toUpperCase()}D
                                        </h2>
                                        
                                    </div>

                                    {!isApprove && declineReason && (
                                        <div className="bg-white border border-red-200 rounded-md p-4">
                                            <div className="flex items-start gap-2">
                                                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                                <div className="flex-1">
                                                    <h4 className="font-semibold text-red-900 mb-1">
                                                        Reason for Decline:
                                                    </h4>
                                                    <p className="text-red-800">{declineReason}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Request Details Summary */}
                                <div className="border rounded-lg p-6 bg-white shadow-sm mb-6">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">
                                        Request Details
                                    </h3>

                                    <div className="grid grid-cols-3 gap-4 mb-6">
                                        <div>
                                            <h4 className="text-sm font-semibold text-gray-700 mb-3">
                                                REQUESTOR INFORMATION
                                            </h4>
                                            <div className="space-y-2">
                                                <div>
                                                    <span className="text-xs text-gray-500">Name:</span>
                                                    <p className="font-medium">{request.user?.name}</p>
                                                </div>
                                                <div>
                                                    <span className="text-xs text-gray-500">Department:</span>
                                                    <p className="font-medium">{request.user?.department || 'N/A'}</p>
                                                </div>
                                                <div>
                                                    <span className="text-xs text-gray-500">Date Requested:</span>
                                                    <p className="font-medium">{formatDateTime(request.created_at)}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <h4 className="text-sm font-semibold text-gray-700 mb-3">
                                                TRAVEL SCHEDULE
                                            </h4>
                                            <div className="space-y-2">
                                                <div>
                                                    <span className="text-xs text-gray-500">Date of Travel:</span>
                                                    <p className="font-medium">{formatDate(request.date_of_travel)}</p>
                                                </div>
                                                <div>
                                                    <span className="text-xs text-gray-500">Duration:</span>
                                                    <p className="font-medium">{request.days_of_travel} day(s)</p>
                                                </div>
                                                <div>
                                                    <span className="text-xs text-gray-500">Time:</span>
                                                    <p className="font-medium">{request.time_of_travel}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mb-6">
                                            <h4 className="text-sm font-semibold text-gray-700 mb-3">
                                                TRIP DETAILS
                                            </h4>
                                            <div className="space-y-3">
                                                <div>
                                                    <span className="text-xs text-gray-500">Destination:</span>
                                                    <p className="font-medium">{request.destination}</p>
                                                </div>
                                                <div>
                                                    <span className="text-xs text-gray-500">Purpose:</span>
                                                    <p className="font-medium">{request.purpose}</p>
                                                </div>
                                                <div>
                                                    <span className="text-xs text-gray-500">Authorized Passengers:</span>
                                                    <p className="font-medium">{request.authorized_passengers}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    

                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                        <h4 className="text-sm font-semibold text-blue-900 mb-3">
                                            ASSIGNED RESOURCES
                                        </h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <span className="text-xs text-blue-700">Vehicle:</span>
                                                <p className="font-medium text-blue-900">
                                                    {request.vehicle?.description || 'Not assigned'}
                                                </p>
                                                <p className="text-sm text-blue-700">
                                                    {request.vehicle?.plate_number || ''}
                                                </p>
                                            </div>
                                            <div>
                                                <span className="text-xs text-blue-700">Driver:</span>
                                                <p className="font-medium text-blue-900">
                                                    {request.driver?.name || 'Not assigned'}
                                                </p>
                                                <p className="text-sm text-blue-700">
                                                    {request.driver?.contact_number || ''}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Action Information */}
                                <div className="border rounded-lg p-6 bg-gray-50 mb-6">
                                    <h4 className="text-sm font-semibold text-gray-700 mb-3">
                                        ACTION INFORMATION
                                    </h4>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <span className="text-xs text-gray-500">Action:</span>
                                            <p className={`font-medium ${
                                                isApprove ? 'text-green-600' : 'text-red-600'
                                            }`}>
                                                {actionText.toUpperCase()}
                                            </p>
                                        </div>
                                        <div>
                                            <span className="text-xs text-gray-500">Processed By:</span>
                                            <p className="font-medium">{approvalAdmin?.name}</p>
                                        </div>
                                        <div>
                                            <span className="text-xs text-gray-500">Date & Time:</span>
                                            <p className="font-medium">{format(new Date(), 'MMMM d, yyyy h:mm a')}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* PDF Preview Frame */}
                                <div className="mb-6">
                                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                                        PDF Preview - This document will be sent to the client:
                                    </h4>
                                    <div className="border rounded-lg overflow-hidden" style={{ height: '500px' }}>
                                        <iframe
                                            src={previewUrl}
                                            className="w-full h-full"
                                            title="Approval/Decline PDF Preview"
                                        />
                                    </div>
                                </div>

                                {/* Warning Message */}
                                <div className="bg-amber-50 border border-amber-200 rounded-md p-4 mb-6">
                                    <div className="flex items-start gap-2">
                                        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                        <div className="flex-1">
                                            <p className="text-sm text-amber-800">
                                                {isApprove ? (
                                                    <>
                                                        <strong>After approval:</strong> This request will be sent to the Client 
                                                        and Ticket Admin for trip ticket preparation. This action cannot be undone.
                                                    </>
                                                ) : (
                                                    <>
                                                        <strong>After decline:</strong> The client will be notified with the 
                                                        decline reason. The assigned resources will be released. This action cannot be undone.
                                                    </>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex justify-between items-center gap-3 pt-4 border-t">
                                    <button
                                        type="button"
                                        onClick={closeModal}
                                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 border rounded-md"
                                        disabled={processing}
                                    >
                                        Cancel
                                    </button>
                                    
                                    <button
                                        onClick={onConfirm}
                                        className={`flex items-center gap-2 px-6 py-2 text-sm font-medium text-white rounded-md disabled:opacity-50 ${
                                            isApprove 
                                                ? 'bg-green-600 hover:bg-green-700' 
                                                : 'bg-red-600 hover:bg-red-700'
                                        }`}
                                        disabled={processing}
                                    >
                                        <ActionIcon className="w-4 h-4" />
                                        {processing ? 'Processing...' : `Confirm ${actionText}`}
                                    </button>
                                </div>
                            </div>
                        </Dialog.Panel>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}