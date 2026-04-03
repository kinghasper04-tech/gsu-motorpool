import React, { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import RequestDetailModal from '@/Components/RequestDetailModal';
import { 
    Calendar, Clock, MapPin, Users, Car, User, 
    Trash2, CheckCircle, XCircle, AlertCircle,
    Filter, Search, FileText, Eye
} from 'lucide-react';
import { format } from 'date-fns';
import { usePage } from '@inertiajs/react';

export default function RequestManagement({ 
    auth, 
    pendingRequests,
    assignedRequests, 
    approvedRequests,
    completedRequests,
    forwardedRequests,
    declinedRequests,
    cancelledRequests,
    vehicles, 
    drivers 
}) {
    const { url } = usePage();
    const initialTab = new URLSearchParams(url.split('?')[1] || '').get('tab') || 'pending';
    const [activeTab, setActiveTab] = useState(initialTab);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedVehicle, setSelectedVehicle] = useState('all');
    const [selectedDriver, setSelectedDriver] = useState('all');
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

    const tabs = [
        { id: 'pending', label: 'Pending', count: pendingRequests.length, color: 'blue' },
        { id: 'assigned', label: 'Assigned', count: assignedRequests.length, color: 'yellow' },
        { id: 'approved', label: 'Approved', count: approvedRequests.length, color: 'green' },
        { id: 'completed', label: 'Completed', count: completedRequests.length, color: 'purple' },
        { id: 'forwarded', label: 'Forwarded for Decline', count: forwardedRequests.length, color: 'orange' },
        { id: 'declined', label: 'Declined', count: declinedRequests.length, color: 'red' },
        { id: 'cancelled', label: 'Cancelled', count: cancelledRequests.length, color: 'gray' },
    ];

    const getCurrentRequests = () => {
        switch(activeTab) {
            case 'pending': return pendingRequests;
            case 'assigned': return assignedRequests;
            case 'approved': return approvedRequests;
            case 'completed': return completedRequests;
            case 'forwarded': return forwardedRequests;
            case 'declined': return declinedRequests;
            case 'cancelled': return cancelledRequests;
            default: return [];
        }
    };

    const currentRequests = getCurrentRequests();

    // Filter requests based on search and selections
    const filteredRequests = currentRequests.filter(request => {
        const matchesSearch = 
            request.destination.toLowerCase().includes(searchTerm.toLowerCase()) ||
            request.purpose.toLowerCase().includes(searchTerm.toLowerCase()) ||
            request.user.name.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesVehicle = selectedVehicle === 'all' || 
            (request.vehicle_id && request.vehicle_id.toString() === selectedVehicle);
        
        const matchesDriver = selectedDriver === 'all' || 
            (request.driver_id && request.driver_id.toString() === selectedDriver);
        
        return matchesSearch && matchesVehicle && matchesDriver;
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

    const formatDate = (date) => format(new Date(date), 'MMMM d, yyyy');
    const formatTime = (time) => format(new Date(`2000-01-01 ${time}`), 'h:mm a');

    const getDaysRemaining = (startDateTime) => {
        const today = new Date();
        const requestDate = new Date(startDateTime);
        const diffTime = requestDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    };

    const getUrgencyColor = (startDateTime) => {
        const daysRemaining = getDaysRemaining(startDateTime);
        if (daysRemaining < 0) return 'bg-red-100 text-red-800';
        if (daysRemaining <= 1) return 'bg-orange-100 text-orange-800';
        if (daysRemaining <= 3) return 'bg-yellow-100 text-yellow-800';
        return 'bg-green-100 text-green-800';
    };

    const handleUnassign = (requestId) => {
        if (confirm('Are you sure you want to unassign this request? This will remove the vehicle and driver assignment.')) {
            router.delete(route('assignment.requests.unassign', requestId));
        }
    };

    const openDetailModal = (request) => {
        setSelectedRequest(request);
        setIsDetailModalOpen(true);
    };

    const closeDetailModal = () => {
        setIsDetailModalOpen(false);
        setSelectedRequest(null);
    };

    const getStatusBadge = (status) => {
        const badges = {
            pending: 'bg-blue-100 text-blue-800',
            assigned: 'bg-yellow-100 text-yellow-800',
            approved: 'bg-green-100 text-green-800',
            completed: 'bg-purple-100 text-purple-800',
            declined: 'bg-red-100 text-red-800',
            cancelled: 'bg-gray-100 text-gray-700',
        };
        
        return (
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${badges[status] || 'bg-gray-100 text-gray-800'}`}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
        );
    };

    const getTabColor = (color) => {
        const colors = {
            blue: 'border-blue-500 text-blue-600',
            yellow: 'border-yellow-500 text-yellow-600',
            green: 'border-green-500 text-green-600',
            purple: 'border-purple-500 text-purple-600',
            orange: 'border-orange-500 text-orange-600',
            red: 'border-red-500 text-red-600',
            gray: 'border-gray-500 text-gray-600',
        };
        return colors[color] || 'border-gray-500 text-gray-600';
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
                                {tabs.map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`py-4 px-6 text-sm font-medium whitespace-nowrap ${
                                            activeTab === tab.id
                                                ? `border-b-2 ${getTabColor(tab.color)}`
                                                : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                    >
                                        {tab.label} ({tab.count})
                                    </button>
                                ))}
                            </nav>
                        </div>

                        {/* Search and Filter */}
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

                                {(activeTab === 'assigned' || activeTab === 'approved' || activeTab === 'completed') && (
                                    <>
                                        <div className="flex items-center gap-2">
                                            <Filter size={16} className="text-gray-500" />
                                            <select
                                                className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                value={selectedVehicle}
                                                onChange={(e) => setSelectedVehicle(e.target.value)}
                                            >
                                                <option value="all">All Vehicles</option>
                                                {vehicles.map(vehicle => (
                                                    <option key={vehicle.id} value={vehicle.id}>
                                                        {vehicle.model} - {vehicle.plate_number}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <select
                                                className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                value={selectedDriver}
                                                onChange={(e) => setSelectedDriver(e.target.value)}
                                            >
                                                <option value="all">All Drivers</option>
                                                {drivers.map(driver => (
                                                    <option key={driver.id} value={driver.id}>
                                                        {driver.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </>
                                )}
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
                                        {searchTerm || selectedVehicle !== 'all' || selectedDriver !== 'all'
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
                                                        {request.user.name}
                                                    </h3>
                                                    {getStatusBadge(request.status)}
                                                    
                                                    {/* Forwarded Badge */}
                                                    {request.forwarded_for_decline === true && (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                                            <AlertCircle size={12} className="mr-1" />
                                                            Forwarded for Decline
                                                        </span>
                                                    )}

                                                    {/* Urgency Badge for Pending */}
                                                    {activeTab === 'pending' && (() => {
                                                        const daysRemaining = getDaysRemaining(request.start_datetime);
                                                        return (
                                                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getUrgencyColor(request.start_datetime)}`}>
                                                                {daysRemaining < 0 
                                                                    ? 'Overdue' 
                                                                    : daysRemaining === 0
                                                                        ? 'Today'
                                                                        : daysRemaining === 1 
                                                                            ? 'Tomorrow' 
                                                                            : `${daysRemaining} days`}
                                                            </span>
                                                        );
                                                    })()}
                                                </div>

                                                {/* User Details for Pending */}
                                                {activeTab === 'pending' && (
                                                    <div className="text-sm text-gray-600 mb-3">
                                                        {request.user.department || 'N/A'} - {request.user.position || 'N/A'}
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
                                                            <span className="font-medium">Date:</span>
                                                            <span className="ml-2 text-gray-700">
                                                                {activeTab === 'pending' 
                                                                    ? `${formatDate(request.date_of_travel)} at ${formatTime(request.time_of_travel)}`
                                                                    : formatDateTime(request.start_datetime)
                                                                }
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

                                                    {/* Show vehicle/driver for assigned, approved, and completed */}
                                                    {(activeTab === 'assigned' || activeTab === 'approved' || activeTab === 'completed') && (
                                                        <>
                                                            <div className="flex items-center gap-2">
                                                                <Car size={16} className="text-blue-600" />
                                                                <div>
                                                                    <span className="font-medium">Vehicle:</span>
                                                                    <span className="ml-2 text-gray-700">
                                                                        {request.vehicle?.model || '—'} - {request.vehicle?.plate_number || '—'}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-2">
                                                                <User size={16} className="text-green-600" />
                                                                <div>
                                                                    <span className="font-medium">Driver:</span>
                                                                    <span className="ml-2 text-gray-700">
                                                                        {request.driver?.name || '—'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </>
                                                    )}

                                                    <div className="flex items-center gap-2">
                                                        <Users size={16} className="text-gray-500" />
                                                        <div>
                                                            <span className="font-medium">Passengers:</span>
                                                            <span className="ml-2 text-gray-700">
                                                                {request.authorized_passengers}
                                                            </span>
                                                        </div>
                                                    </div>
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
                                                        <span className="font-medium text-orange-900 text-sm">Reason for Forwarding:</span>
                                                        <p className="text-orange-800 text-sm mt-1 italic">
                                                            "{request.forwarded_decline_reason}"
                                                        </p>
                                                    </div>
                                                )}

                                                {/* Decline Reason */}
                                                {activeTab === 'declined' && request.decline_reason && (
                                                    <div className="mb-4 p-3 bg-red-100 border border-red-200 rounded-md">
                                                        <span className="font-medium text-red-900 text-sm">Decline Reason:</span>
                                                        <p className="text-red-800 text-sm mt-1">
                                                            {request.decline_reason}
                                                        </p>
                                                    </div>
                                                )}

                                                {/* Timestamp Info */}
                                                <div className="text-sm text-gray-500">
                                                    {activeTab === 'pending' && `Submitted on ${new Date(request.created_at).toLocaleDateString()}`}
                                                    {activeTab === 'assigned' && request.assignment && `Assigned on ${new Date(request.assignment.created_at).toLocaleDateString()}`}
                                                    {activeTab === 'approved' && request.approved_at && `Approved on ${new Date(request.approved_at).toLocaleDateString()}`}
                                                    {activeTab === 'completed' && `Completed on ${new Date(request.end_datetime).toLocaleDateString()}`}
                                                    {activeTab === 'declined' && request.declined_at && `Declined on ${new Date(request.declined_at).toLocaleDateString()}`}
                                                    {activeTab === 'forwarded' && request.updated_at && `Forwarded on ${new Date(request.updated_at).toLocaleDateString()}`}
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

                                                {activeTab === 'pending' && (
                                                    <Link
                                                        href={route('assignment.requests.assign.view', request.id)}
                                                        className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition font-medium text-center"
                                                    >
                                                        Assign Vehicle & Driver
                                                    </Link>
                                                )}

                                                {activeTab === 'assigned' && !request.forwarded_for_decline && (
                                                    <button
                                                        onClick={() => handleUnassign(request.id)}
                                                        className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition text-sm flex items-center gap-1"
                                                    >
                                                        <Trash2 size={14} />
                                                        Unassign
                                                    </button>
                                                )}

                                                {activeTab === 'forwarded' && (
                                                    <div className="flex items-center gap-2 text-orange-600 bg-orange-100 px-4 py-2 rounded-md">
                                                        <AlertCircle size={16} />
                                                        <span className="text-sm font-medium">Awaiting Decline</span>
                                                    </div>
                                                )}

                                                {activeTab === 'approved' && (
                                                    <div className="flex items-center gap-2 text-green-600">
                                                        <CheckCircle size={16} />
                                                        <span className="text-sm font-medium">Approved</span>
                                                    </div>
                                                )}

                                                {activeTab === 'completed' && (
                                                    <div className="flex items-center gap-2 text-purple-600">
                                                        <CheckCircle size={16} />
                                                        <span className="text-sm font-medium">Completed</span>
                                                    </div>
                                                )}

                                                {activeTab === 'declined' && (
                                                    <div className="flex items-center gap-2 text-red-600">
                                                        <XCircle size={16} />
                                                        <span className="text-sm font-medium">Declined</span>
                                                    </div>
                                                )}

                                                {activeTab === 'cancelled' && (
                                                    <div className="mb-4 p-3 bg-gray-100 border border-gray-200 rounded-md">
                                                        <span className="font-medium text-gray-700 text-sm">This request was cancelled by the client.</span>
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

            {/* Request Detail Modal */}
            <RequestDetailModal
                isOpen={isDetailModalOpen}
                onClose={closeDetailModal}
                request={selectedRequest}
            />
        </AuthenticatedLayout>
    );
}