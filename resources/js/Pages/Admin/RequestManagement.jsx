import React, { useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import ApprovalPreviewModal from '@/Components/ApprovalPreviewModal';
import RequestDetailModal from '@/Components/RequestDetailModal';
import {
    Calendar, Clock, MapPin, Users, Car, User,
    CheckCircle2, XCircle, AlertCircle, AlertTriangle,
    Filter, Search, FileText, Eye
} from 'lucide-react';

export default function RequestManagement({
    auth,
    pendingRequests,
    forwardedRequests,
    approvedRequests,
    declinedRequests,
    completedRequests,
    cancelledRequests,
}) {
    const { auth: pageAuth } = usePage().props;
    const [activeTab, setActiveTab] = useState('pending');
    const [searchTerm, setSearchTerm] = useState('');
    const [submittingId, setSubmittingId] = useState(null);
    const [declineReason, setDeclineReason] = useState('');
    const [showDeclineModal, setShowDeclineModal] = useState(false);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [previewAction, setPreviewAction] = useState(null);
    const [previewUrl, setPreviewUrl] = useState('');
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

    const tabs = [
        { id: 'pending', label: 'Pending Approval', count: pendingRequests.length, color: 'blue', icon: Clock },
        { id: 'forwarded', label: 'Forwarded for Decline', count: forwardedRequests.length, color: 'orange', icon: AlertCircle },
        { id: 'approved', label: 'Approved', count: approvedRequests.length, color: 'green', icon: CheckCircle2 },
        { id: 'declined', label: 'Declined', count: declinedRequests.length, color: 'red', icon: XCircle },
        { id: 'completed', label: 'Completed', count: completedRequests.length, color: 'purple', icon: CheckCircle2 },
        { id: 'cancelled', label: 'Cancelled', count: cancelledRequests.length, color: 'gray', icon: XCircle },
    ];

    const getCurrentRequests = () => {
        switch(activeTab) {
            case 'pending': return pendingRequests;
            case 'forwarded': return forwardedRequests;
            case 'approved': return approvedRequests;
            case 'declined': return declinedRequests;
            case 'completed': return completedRequests;
            case 'cancelled': return cancelledRequests;
            default: return [];
        }
    };

    const currentRequests = getCurrentRequests();

    // Filter requests based on search
    const filteredRequests = currentRequests.filter(request => {
        const matchesSearch =
            request.destination.toLowerCase().includes(searchTerm.toLowerCase()) ||
            request.purpose.toLowerCase().includes(searchTerm.toLowerCase()) ||
            request.user.name.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch;
    });

    const formatDateTime = (dateTime) => {
        return new Date(dateTime).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getTabColor = (color) => {
        const colors = {
            blue: 'border-blue-500 text-blue-600 bg-blue-50',
            orange: 'border-orange-500 text-orange-600 bg-orange-50',
            green: 'border-green-500 text-green-600 bg-green-50',
            red: 'border-red-500 text-red-600 bg-red-50',
            purple: 'border-purple-500 text-purple-600 bg-purple-50',
            gray: 'border-gray-500 text-gray-600 bg-gray-50',
        };
        return colors[color] || 'border-gray-500 text-gray-600';
    };

    const getTabColorInactive = (color) => {
        const colors = {
            blue: 'text-blue-600 hover:bg-blue-50',
            orange: 'text-orange-600 hover:bg-orange-50',
            green: 'text-green-600 hover:bg-green-50',
            red: 'text-red-600 hover:bg-red-50',
            purple: 'text-purple-600 hover:bg-purple-50',
            gray: 'text-gray-600 hover:bg-gray-50',
        };
        return colors[color] || 'text-gray-600 hover:bg-gray-50';
    };

    const openDetailModal = (request) => {
        setSelectedRequest(request);
        setIsDetailModalOpen(true);
    };

    const closeDetailModal = () => {
        setIsDetailModalOpen(false);
        setTimeout(() => setSelectedRequest(null), 300);
    };

    // Approval handlers
    const handleApproveClick = (request) => {
        if (request.forwarded_for_decline) {
            alert('This request was forwarded by the assignment admin for declining due to resource unavailability. Please decline this request.');
            return;
        }

        setSelectedRequest(request);
        setPreviewAction('approve');
        const url = route('admin.requests.preview-approval', {
            id: request.id,
            action: 'approve'
        });
        setPreviewUrl(url);
        setShowPreviewModal(true);
    };

    const confirmApprove = () => {
        if (!selectedRequest) return;

        setSubmittingId(selectedRequest.id);
        router.post(route('admin.requests.approve', selectedRequest.id), {}, {
            preserveScroll: true,
            onSuccess: () => {
                setShowPreviewModal(false);
                setSubmittingId(null);
                setSelectedRequest(null);
                setPreviewAction(null);
            },
            onError: (errors) => {
                console.error('Approval error:', errors);
                alert(errors.error || 'Failed to approve request');
                setSubmittingId(null);
            },
            onFinish: () => {
                setSubmittingId(null);
            }
        });
    };

    const handleDeclineClick = (request) => {
        setSelectedRequest(request);
        if (request.forwarded_for_decline && request.forwarded_decline_reason) {
            setDeclineReason(request.forwarded_decline_reason);
        }
        setShowDeclineModal(true);
    };

    const handleDeclineReasonSubmit = () => {
        if (!selectedRequest) {
            alert('No request selected.');
            return;
        }

        if (!declineReason.trim()) {
            alert('Please provide a reason for declining.');
            return;
        }

        setShowDeclineModal(false);
        setPreviewAction('decline');
        const url = route('admin.requests.preview-approval', {
            id: selectedRequest.id,
            action: 'decline',
            decline_reason: encodeURIComponent(declineReason)
        });
        setPreviewUrl(url);
        setShowPreviewModal(true);
    };

    const confirmDecline = () => {
        if (!selectedRequest) return;

        setSubmittingId(selectedRequest.id);
        router.post(route('admin.requests.decline', selectedRequest.id), {
            decline_reason: declineReason.trim()
        }, {
            preserveScroll: true,
            onSuccess: () => {
                setShowPreviewModal(false);
                setSubmittingId(null);
                setSelectedRequest(null);
                setPreviewAction(null);
                setDeclineReason('');
            },
            onError: (errors) => {
                console.error('Decline error:', errors);
                if (errors.decline_reason) {
                    alert('Decline reason error: ' + errors.decline_reason);
                } else if (errors.error) {
                    alert('Error: ' + errors.error);
                } else {
                    alert('Failed to decline request. Please try again.');
                }
                setSubmittingId(null);
            },
            onFinish: () => {
                setSubmittingId(null);
            }
        });
    };

    const closeDeclineModal = () => {
        setShowDeclineModal(false);
        setDeclineReason('');
        setSelectedRequest(null);
    };

    const closePreviewModal = () => {
        setShowPreviewModal(false);
        setSelectedRequest(null);
        setPreviewAction(null);
        setDeclineReason('');
        setPreviewUrl('');
    };

    return (
        <AuthenticatedLayout
            user={auth.user}
            header={
                <div className="flex justify-between items-center gap-4">
                    <h2 className="font-semibold text-xl text-gray-800 leading-tight">
                        Request Management
                    </h2>
                </div>
            }
        >
            <Head title="Request Management" />

            <div className="py-2">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
                    <div className="bg-white overflow-hidden shadow-sm sm:rounded-lg">
                        {/* Tabs */}
                        <div className="border-b border-gray-200 overflow-x-auto">
                            <nav className="-mb-px flex">
                                {tabs.map((tab) => {
                                    const Icon = tab.icon;
                                    return (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id)}
                                            className={`py-4 px-6 text-sm font-medium whitespace-nowrap flex items-center gap-2 transition-all ${
                                                activeTab === tab.id
                                                    ? `border-b-2 ${getTabColor(tab.color)}`
                                                    : `text-gray-500 hover:text-gray-700 ${getTabColorInactive(tab.color)}`
                                            }`}
                                        >
                                            <Icon size={16} />
                                            {tab.label} ({tab.count})
                                        </button>
                                    );
                                })}
                            </nav>
                        </div>

                        {/* Search Bar */}
                        <div className="p-6 bg-gray-50 border-b border-gray-200">
                            <div className="flex flex-wrap gap-4 items-center">
                                <div className="flex-1 min-w-64">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                                        <input
                                            type="text"
                                            placeholder="Search by destination, purpose, or requester..."
                                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Requests List */}
                        <div className="divide-y divide-gray-200">
                            {filteredRequests.length === 0 ? (
                                <div className="p-12 text-center">
                                    <div className="text-gray-400 mb-4">
                                        <FileText size={48} className="mx-auto" />
                                    </div>
                                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                                        No {activeTab} requests found
                                    </h3>
                                    <p className="text-gray-600">
                                        {searchTerm
                                            ? 'No requests match your search criteria.'
                                            : `There are no ${activeTab} requests at the moment.`}
                                    </p>
                                </div>
                            ) : (
                                filteredRequests.map((request) => (
                                    <div
                                        key={request.id}
                                        className={`p-6 hover:bg-gray-50 transition ${
                                            request.forwarded_for_decline ? 'bg-orange-50' : ''
                                        }`}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                {/* Request Header */}
                                                <div className="flex items-center gap-3 mb-3">
                                                    <h3 className="text-lg font-semibold text-gray-900">
                                                        Request #{request.id} - {request.user.name}
                                                    </h3>
                                                    
                                                    {/* Status Badge */}
                                                    {activeTab === 'pending' && (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                            <Clock size={12} className="mr-1" />
                                                            Pending Approval
                                                        </span>
                                                    )}
                                                    {activeTab === 'forwarded' && (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                                            <AlertCircle size={12} className="mr-1" />
                                                            Must Decline
                                                        </span>
                                                    )}
                                                    {activeTab === 'approved' && (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                            <CheckCircle2 size={12} className="mr-1" />
                                                            Approved
                                                        </span>
                                                    )}
                                                    {activeTab === 'declined' && (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                            <XCircle size={12} className="mr-1" />
                                                            Declined
                                                        </span>
                                                    )}
                                                    {activeTab === 'completed' && (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                                            <CheckCircle2 size={12} className="mr-1" />
                                                            Completed
                                                        </span>
                                                    )}
                                                    {activeTab === 'cancelled' && (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                                            <XCircle size={12} className="mr-1" />
                                                            Cancelled
                                                        </span>
                                                    )}
                                                </div>

                                                {/* User Department/Position */}
                                                {(request.user.department || request.user.position) && (
                                                    <div className="text-sm text-gray-600 mb-3">
                                                        {[request.user.department, request.user.position].filter(Boolean).join(' - ')}
                                                    </div>
                                                )}

                                                {/* Request Details Grid */}
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                                                    <div className="flex items-center gap-2">
                                                        <MapPin size={16} className="text-gray-500" />
                                                        <div>
                                                            <span className="font-medium">Destination:</span>
                                                            <span className="ml-2 text-gray-700">{request.destination}</span>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        <Calendar size={16} className="text-gray-500" />
                                                        <div>
                                                            <span className="font-medium">Travel Date:</span>
                                                            <span className="ml-2 text-gray-700">
                                                                {formatDateTime(request.start_datetime)}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        <Clock size={16} className="text-gray-500" />
                                                        <div>
                                                            <span className="font-medium">Duration:</span>
                                                            <span className="ml-2 text-gray-700">
                                                                {request.days_of_travel} day(s)
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Show vehicle/driver for all tabs if they exist */}
                                                    {request.vehicle && (
                                                        <div className="flex items-center gap-2">
                                                            <Car size={16} className="text-blue-600" />
                                                            <div>
                                                                <span className="font-medium">Vehicle:</span>
                                                                <span className="ml-2 text-gray-700">
                                                                    {request.vehicle.description} - {request.vehicle.plate_number}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {request.driver && (
                                                        <div className="flex items-center gap-2">
                                                            <User size={16} className="text-green-600" />
                                                            <div>
                                                                <span className="font-medium">Driver:</span>
                                                                <span className="ml-2 text-gray-700">
                                                                    {request.driver.name}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {request.authorized_passengers && (
                                                        <div className="flex items-center gap-2">
                                                            <Users size={16} className="text-gray-500" />
                                                            <div>
                                                                <span className="font-medium">Passengers:</span>
                                                                <span className="ml-2 text-gray-700">
                                                                    {request.authorized_passengers}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Purpose */}
                                                {request.purpose && (
                                                    <div className="mb-4">
                                                        <span className="font-medium text-gray-700">Purpose:</span>
                                                        <p className="text-gray-600 mt-1 leading-relaxed">
                                                            {request.purpose}
                                                        </p>
                                                    </div>
                                                )}

                                                {/* Forwarded Reason */}
                                                {request.forwarded_for_decline === true && request.forwarded_decline_reason && (
                                                    <div className="mb-4 p-3 bg-orange-100 border border-orange-200 rounded-md">
                                                        <span className="font-medium text-orange-900 text-sm">Assignment Admin's Reason:</span>
                                                        <p className="text-orange-800 text-sm mt-1 italic">
                                                            "{request.forwarded_decline_reason}"
                                                        </p>
                                                    </div>
                                                )}

                                                {/* Decline Reason */}
                                                {activeTab === 'declined' && request.decline_reason && (
                                                    <div className="mb-4 p-3 bg-red-100 border-l-4 border-red-400 rounded-md">
                                                        <div className="flex items-start gap-2">
                                                            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                                                            <div>
                                                                <span className="font-medium text-red-900 text-sm">Decline Reason:</span>
                                                                <p className="text-red-800 text-sm mt-1">
                                                                    {request.decline_reason}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {activeTab === 'cancelled' && (
                                                    <div className="mb-4 p-3 bg-gray-100 border border-gray-200 rounded-md">
                                                        <span className="font-medium text-gray-700 text-sm">This request was cancelled by the client.</span>
                                                    </div>
                                                )}

                                                {/* Timestamp Info */}
                                                <div className="text-sm text-gray-500">
                                                    {activeTab === 'pending' && request.created_at && `Submitted on ${new Date(request.created_at).toLocaleDateString()}`}
                                                    {activeTab === 'forwarded' && request.updated_at && `Forwarded on ${new Date(request.updated_at).toLocaleDateString()}`}
                                                    {activeTab === 'approved' && request.approved_at && `Approved on ${new Date(request.approved_at).toLocaleDateString()}`}
                                                    {activeTab === 'declined' && request.declined_at && `Declined on ${new Date(request.declined_at).toLocaleDateString()}`}
                                                    {activeTab === 'completed' && request.end_datetime && `Completed on ${new Date(request.end_datetime).toLocaleDateString()}`}
                                                    {activeTab === 'cancelled' && request.cancelled_at && `Cancelled on ${new Date(request.cancelled_at).toLocaleDateString()}`}
                                                </div>
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="ml-6 flex flex-col gap-2">
                                                {/* View Details Button - Show for all tabs */}
                                                <button
                                                    onClick={() => openDetailModal(request)}
                                                    className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition text-sm flex items-center gap-2 whitespace-nowrap"
                                                >
                                                    <Eye size={14} />
                                                    View Details
                                                </button>

                                                {activeTab === 'pending' && request.forwarded_for_decline !== true && (
                                                    <>
                                                        <button
                                                            onClick={() => handleApproveClick(request)}
                                                            disabled={submittingId === request.id}
                                                            className="bg-green-600 hover:bg-green-700 disabled:bg-green-300 disabled:cursor-not-allowed text-white px-6 py-2 rounded-md transition font-medium flex items-center gap-2"
                                                        >
                                                            <CheckCircle2 size={16} />
                                                            Approve
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeclineClick(request)}
                                                            disabled={submittingId === request.id}
                                                            className="bg-red-600 hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed text-white px-6 py-2 rounded-md transition font-medium flex items-center gap-2"
                                                        >
                                                            <XCircle size={16} />
                                                            Decline
                                                        </button>
                                                    </>
                                                )}

                                                {(activeTab === 'forwarded' || (activeTab === 'pending' && request.forwarded_for_decline === true)) && (
                                                    <button
                                                        onClick={() => handleDeclineClick(request)}
                                                        disabled={submittingId === request.id}
                                                        className="bg-red-600 hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed text-white px-6 py-2 rounded-md transition font-medium flex items-center gap-2"
                                                    >
                                                        <XCircle size={16} />
                                                        Decline Request
                                                    </button>
                                                )}

                                                {activeTab === 'approved' && (
                                                    <div className="flex items-center gap-2 text-green-600">
                                                        <CheckCircle2 size={16} />
                                                        <span className="text-sm font-medium">Approved</span>
                                                    </div>
                                                )}

                                                {activeTab === 'declined' && (
                                                    <div className="flex items-center gap-2 text-red-600">
                                                        <XCircle size={16} />
                                                        <span className="text-sm font-medium">Declined</span>
                                                    </div>
                                                )}

                                                {activeTab === 'completed' && (
                                                    <div className="flex items-center gap-2 text-purple-600">
                                                        <CheckCircle2 size={16} />
                                                        <span className="text-sm font-medium">Completed</span>
                                                    </div>
                                                )}

                                                {activeTab === 'cancelled' && (
                                                    <div className="flex items-center gap-2 text-gray-500">
                                                        <XCircle size={16} />
                                                        <span className="text-sm font-medium">Cancelled</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Summary Stats */}
                        {filteredRequests.length > 0 && (
                            <div className="p-6 bg-gray-50 border-t border-gray-200">
                                <div className="text-sm text-gray-600">
                                    Showing {filteredRequests.length} of {currentRequests.length} {activeTab} requests
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Decline Reason Modal */}
            {showDeclineModal && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                    <div className="relative top-20 mx-auto p-5 border w-[500px] shadow-lg rounded-md bg-white">
                        <div className="mt-3">
                            <div className="flex items-center gap-2 mb-4">
                                {selectedRequest?.forwarded_for_decline ? (
                                    <AlertCircle className="w-6 h-6 text-orange-600" />
                                ) : (
                                    <AlertTriangle className="w-6 h-6 text-red-600" />
                                )}
                                <h3 className="text-lg font-medium text-gray-900">
                                    {selectedRequest?.forwarded_for_decline
                                        ? 'Decline Forwarded Request'
                                        : 'Decline Request'
                                    }
                                </h3>
                            </div>

                            {selectedRequest?.forwarded_for_decline === true && (
                                <div className="mb-4 p-4 bg-orange-50 border-2 border-orange-300 rounded-md">
                                    <div className="flex items-start gap-2">
                                        <AlertCircle size={18} className="text-orange-600 mt-0.5 flex-shrink-0" />
                                        <div className="flex-1">
                                            <p className="text-sm font-semibold text-orange-900">No Resources Available</p>
                                            <p className="text-xs text-orange-700 mt-1">
                                                The assignment admin forwarded this request because no vehicles or drivers were available for the requested time period.
                                            </p>
                                            {selectedRequest.forwarded_decline_reason && (
                                                <div className="mt-3 pt-3 border-t border-orange-200">
                                                    <p className="text-xs font-medium text-orange-800">Assignment Admin's Reason:</p>
                                                    <p className="text-sm text-orange-900 mt-1 italic">
                                                        "{selectedRequest.forwarded_decline_reason}"
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <p className="text-sm text-gray-600 mb-2">
                                {selectedRequest?.forwarded_for_decline
                                    ? 'You can edit the decline reason below before confirming:'
                                    : 'Please provide a reason for declining this request:'
                                }
                                <span className="text-red-500">*</span>
                            </p>

                            <textarea
                                value={declineReason}
                                onChange={(e) => setDeclineReason(e.target.value)}
                                placeholder="Reason for declining"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                                rows="4"
                                maxLength="500"
                                required
                            />
                            <div className="text-right text-xs text-gray-500 mt-1">
                                {declineReason.length}/500 characters
                            </div>

                            <div className="flex justify-end space-x-3 mt-6">
                                <button
                                    onClick={closeDeclineModal}
                                    className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 text-sm font-medium rounded-md transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeclineReasonSubmit}
                                    disabled={!declineReason.trim() || declineReason.trim().length < 5}
                                    className="px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-red-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors"
                                >
                                    {selectedRequest?.forwarded_for_decline
                                        ? 'Confirm Decline'
                                        : 'Continue to Preview'
                                    }
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Approval/Decline Preview Modal */}
            <ApprovalPreviewModal
                isOpen={showPreviewModal}
                closeModal={closePreviewModal}
                request={selectedRequest}
                action={previewAction}
                declineReason={declineReason}
                approvalAdmin={pageAuth.user}
                onConfirm={previewAction === 'approve' ? confirmApprove : confirmDecline}
                processing={submittingId === selectedRequest?.id}
                previewUrl={previewUrl}
            />

            {/* Request Detail Modal */}
            <RequestDetailModal
                isOpen={isDetailModalOpen}
                onClose={closeDetailModal}
                request={selectedRequest}
            />
        </AuthenticatedLayout>
    );
}