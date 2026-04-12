import React, { useState, useEffect } from "react";
import { Head, router } from "@inertiajs/react";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import RequestDetailsModal from "@/Components/RequestDetailsModal";
import TripTicketPreviewModal from "@/Components/TripTicketPreviewModal.jsx";
import TripTicketViewModal from "@/Components/TripTicketViewModal";
import CreateTripTicketModal from "@/Components/CreateTripTicketModal";
import { format } from "date-fns";
import { FileText, Clock, CheckCircle, Plus, X, Download, Loader2 } from "lucide-react";
import { usePage } from '@inertiajs/react';

export default function PendingRequests({ pendingRequests = [], allTickets = [], completedTickets = [], cancelledRequests = [], previewRequest: initialPreviewRequest = null, createdTripTicket: initialCreatedTicket = null }) {
    const { url } = usePage();
    const initialTab = new URLSearchParams(url.split('?')[1] || '').get('tab') || 'pending';
    const [activeTab, setActiveTab] = useState(initialTab);
    const [activeSubTab, setActiveSubTab] = useState('active');
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [previewRequest, setPreviewRequest] = useState(null);
    const [viewRequest, setViewRequest] = useState(null);
    const [ticketNumber, setTicketNumber] = useState('');
    const [processing, setProcessing] = useState(false);
    const [sending, setSending] = useState(false);
    const [creatingTicket, setCreatingTicket] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showSuccessMessage, setShowSuccessMessage] = useState(false);
    const [savedFormData, setSavedFormData] = useState(null);
    
    // Export filters
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1); // 1-12
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [allTime, setAllTime] = useState(false);
    const [exporting, setExporting] = useState(false);

    // Get available years from tickets
    const availableYears = React.useMemo(() => {
        const years = new Set();
        [...allTickets, ...completedTickets, ...cancelledRequests].forEach(ticket => {
            const year = new Date(ticket.date_of_travel).getFullYear();
            years.add(year);
        });
        return Array.from(years).sort((a, b) => b - a);
    }, [allTickets, completedTickets, cancelledRequests]);

    // Handle preview request from backend
    useEffect(() => {
        if (initialPreviewRequest) {
            setPreviewRequest(initialPreviewRequest);
            setIsPreviewModalOpen(true);
        }
    }, [initialPreviewRequest]);

    // Handle created trip ticket - show view modal with PDF preview
    useEffect(() => {
        if (initialCreatedTicket) {
            setViewRequest(initialCreatedTicket);
            setIsViewModalOpen(true);
            setActiveTab('all');
            setActiveSubTab('active');
            setShowSuccessMessage(true);
            
            const timer = setTimeout(() => {
                setShowSuccessMessage(false);
            }, 5000);
            
            return () => clearTimeout(timer);
        }
    }, [initialCreatedTicket]);

    const handleSubmit = (requestId, ticketNumber) => {
        setProcessing(true);

        router.post(
            route('tickets.update-trip-ticket', requestId),
            {
                trip_ticket_number: ticketNumber
            },
            {
                preserveScroll: true,
                preserveState: true,
                onSuccess: (page) => {
                    setIsModalOpen(false);
                    setProcessing(false);
                    
                    const updatedRequest = { ...selectedRequest, trip_ticket_number: ticketNumber };
                    setPreviewRequest(updatedRequest);
                    setIsPreviewModalOpen(true);
                },
                onError: (errors) => {
                    alert(errors.trip_ticket_number || 'Failed to update ticket number');
                    setProcessing(false);
                },
                onFinish: () => {
                    setProcessing(false);
                }
            }
        );
    };

    const openModal = (request) => {
        setSelectedRequest(request);
        setTicketNumber(request.trip_ticket_number || '');
        setIsModalOpen(true);
    };

    const handleBackToEdit = () => {
        if (!previewRequest?.is_new_ticket) {
            setIsPreviewModalOpen(false);
            setTicketNumber('');
            setPreviewRequest(null);
            setIsModalOpen(true);
        } else {
            setSending(true);

            fetch(route('tickets.create-trip-ticket.cancel'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
                },
                body: JSON.stringify({
                    request_id: previewRequest.id
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    setIsPreviewModalOpen(false);
                    setPreviewRequest(null);
                    setIsCreateModalOpen(true);
                } else {
                    alert('Failed to cancel preview: ' + (data.error || 'Unknown error'));
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('Failed to cancel preview');
            })
            .finally(() => {
                setSending(false);
            });
        }
    };

    const openViewModal = (request) => {
        setViewRequest(request);
        setIsViewModalOpen(true);
    };

    const handleSendToAssignmentAdmin = (requestId) => {
        setSending(true);

        router.post(
            route('tickets.send-to-assignment-admin', requestId),
            {},
            {
                onSuccess: () => {
                    setSending(false);
                    setIsPreviewModalOpen(false);
                    setPreviewRequest(null);
                    setSelectedRequest(null);
                    setTicketNumber('');
                    setActiveTab('all');
                    setActiveSubTab('active');
                },
                onError: (errors) => {
                    setSending(false);
                    alert('Failed to send trip ticket: ' + (errors.message || 'Unknown error'));
                },
            }
        );
    };

    const handlePreviewNewTicket = (formData) => {
        setCreatingTicket(true);
        setSavedFormData(formData);

        router.post(
            route('tickets.create-trip-ticket.preview'),
            formData,
            {
                preserveScroll: true,
                onSuccess: () => {
                    setCreatingTicket(false);
                    setIsCreateModalOpen(false);
                },
                onError: (errors) => {
                    setCreatingTicket(false);
                    const errorMessages = Object.values(errors).flat().join('\n');
                    alert('Validation errors:\n' + errorMessages);
                },
            }
        );
    };

    const handleConfirmCreateTicket = (requestId) => {
        setSending(true);

        router.post(
            route('tickets.create-trip-ticket.confirm'),
            { request_id: requestId },
            {
                onSuccess: () => {
                    setSending(false);
                    setIsPreviewModalOpen(false);
                    setPreviewRequest(null);
                    setSavedFormData(null);
                },
                onError: (errors) => {
                    setSending(false);
                    alert('Failed to create trip ticket: ' + (errors.message || 'Unknown error'));
                },
            }
        );
    };

    // Filter tickets based on search, month, year, and allTime
    const filteredTickets = React.useMemo(() => {
        return allTickets.filter(ticket => {
            if (ticket.status === 'cancelled') return false;
            // Search filter
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const matchesSearch = (
                    ticket.trip_ticket_number?.toLowerCase().includes(query) ||
                    ticket.user?.name?.toLowerCase().includes(query) ||
                    ticket.driver?.name?.toLowerCase().includes(query) ||
                    ticket.vehicle?.plate_number?.toLowerCase().includes(query) ||
                    ticket.destination?.toLowerCase().includes(query)
                );
                if (!matchesSearch) return false;
            }

            // Date filter
            if (!allTime) {
                const ticketDate = new Date(ticket.date_of_travel);
                const ticketMonth = ticketDate.getMonth() + 1; // 1-12
                const ticketYear = ticketDate.getFullYear();

                if (ticketMonth !== selectedMonth || ticketYear !== selectedYear) {
                    return false;
                }
            }

            return true;
        });
    }, [allTickets, searchQuery, selectedMonth, selectedYear, allTime]);

    const filteredCancelledTickets = React.useMemo(() => {
        return cancelledRequests.filter(ticket => {
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const matchesSearch = (
                    ticket.trip_ticket_number?.toLowerCase().includes(query) ||
                    ticket.user?.name?.toLowerCase().includes(query) ||
                    ticket.driver?.name?.toLowerCase().includes(query) ||
                    ticket.vehicle?.plate_number?.toLowerCase().includes(query) ||
                    ticket.destination?.toLowerCase().includes(query)
                );
                if (!matchesSearch) return false;
            }

            if (!allTime) {
                const ticketDate = new Date(ticket.date_of_travel);
                const ticketMonth = ticketDate.getMonth() + 1;
                const ticketYear = ticketDate.getFullYear();
                if (ticketMonth !== selectedMonth || ticketYear !== selectedYear) return false;
            }

            return true;
        });
    }, [cancelledRequests, searchQuery, selectedMonth, selectedYear, allTime]);

    const sortedTickets = React.useMemo(() => {
        return [...filteredTickets].sort((a, b) => {
            if (!a.trip_ticket_number || !b.trip_ticket_number) return 0;
            return a.trip_ticket_number.localeCompare(b.trip_ticket_number);
        });
    }, [filteredTickets]);

    const sortedCancelledTickets = React.useMemo(() => {
        return [...filteredCancelledTickets].sort((a, b) =>
            (a.trip_ticket_number || '').localeCompare(b.trip_ticket_number || '')
        );
    }, [filteredCancelledTickets]);

    const filteredCompletedTickets = React.useMemo(() => {
        return completedTickets.filter(ticket => {
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const matchesSearch = (
                    ticket.trip_ticket_number?.toLowerCase().includes(query) ||
                    ticket.user?.name?.toLowerCase().includes(query) ||
                    ticket.driver?.name?.toLowerCase().includes(query) ||
                    ticket.vehicle?.plate_number?.toLowerCase().includes(query) ||
                    ticket.destination?.toLowerCase().includes(query)
                );
                if (!matchesSearch) return false;
            }

            if (!allTime) {
                const ticketDate = new Date(ticket.date_of_travel);
                const ticketMonth = ticketDate.getMonth() + 1;
                const ticketYear = ticketDate.getFullYear();
                if (ticketMonth !== selectedMonth || ticketYear !== selectedYear) return false;
            }

            return true;
        });
    }, [completedTickets, searchQuery, selectedMonth, selectedYear, allTime]);

    const sortedCompletedTickets = React.useMemo(() => {
        return [...filteredCompletedTickets].sort((a, b) =>
            (a.trip_ticket_number || '').localeCompare(b.trip_ticket_number || '')
        );
    }, [filteredCompletedTickets]);

    const handleExportExcel = async () => {
        setExporting(true);
        try {
            // Prepare tickets data for export
            const mergedTickets = [...sortedTickets, ...sortedCompletedTickets, ...sortedCancelledTickets].sort((a, b) =>
                (a.trip_ticket_number || '').localeCompare(b.trip_ticket_number || '')
            );

            const ticketsToExport = mergedTickets.map(ticket => ({
                trip_ticket_no: ticket.trip_ticket_number,
                driver: ticket.driver?.name || 'N/A',
                vehicle: `${ticket.vehicle?.plate_number || 'N/A'} - ${ticket.vehicle?.description || ''}`,
                passengers: ticket.authorized_passengers || '',
                destination: ticket.destination,
                purpose: ticket.purpose,
                date_of_travel: format(new Date(ticket.date_of_travel), 'MMMM d, yyyy'),
                status: ticket.status,
                remarks: ''
            }));

            const response = await fetch('/ticket/export/excel', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
                },
                body: JSON.stringify({
                    tickets: ticketsToExport,
                    month: allTime ? null : selectedMonth,
                    year: allTime ? null : selectedYear,
                    all_time: allTime
                })
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                
                // Generate filename
                let filename = 'trip_tickets_';
                if (allTime) {
                    filename += 'all_time';
                } else {
                    const monthName = new Date(selectedYear, selectedMonth - 1).toLocaleString('en-US', { month: 'long' });
                    filename += `${monthName}_${selectedYear}`;
                }
                filename += '.xlsx';
                
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            } else {
                alert('Failed to export Excel');
            }
        } catch (error) {
            console.error('Excel export error:', error);
            alert('Failed to export Excel');
        } finally {
            setExporting(false);
        }
    };

    const formatDate = (dateString) => {
        return format(new Date(dateString), 'MMMM d, yyyy');
    };

    const formatTime = (timeString) => {
        return format(new Date(`2000-01-01 ${timeString}`), 'h:mm a');
    };

    const months = [
        { value: 1, label: 'January' },
        { value: 2, label: 'February' },
        { value: 3, label: 'March' },
        { value: 4, label: 'April' },
        { value: 5, label: 'May' },
        { value: 6, label: 'June' },
        { value: 7, label: 'July' },
        { value: 8, label: 'August' },
        { value: 9, label: 'September' },
        { value: 10, label: 'October' },
        { value: 11, label: 'November' },
        { value: 12, label: 'December' }
    ];

    const renderTable = (requests, showActions = true) => (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="min-w-full w-full table-auto">
                <thead>
                    <tr className="bg-gray-50 text-left">
                        {activeTab === 'all' && (
                            <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                                Trip Ticket #
                            </th>
                        )}
                        <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                            Requestor
                        </th>
                        <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                            Driver
                        </th>
                        <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                            Vehicle
                        </th>
                        <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                            Destination
                        </th>
                        <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                            Travel Date & Time
                        </th>
                        {activeSubTab === 'cancelled' && (
                            <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                                Cancelled At
                            </th>
                        )}
                        {showActions && (
                            <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                                Actions
                            </th>
                        )}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {requests.length === 0 ? (
                        <tr>
                            <td colSpan={activeSubTab === 'cancelled' ? 7 : activeTab === 'all' ? 7 : 6} className="px-6 py-8 text-center text-gray-500">
                                <div className="flex flex-col items-center justify-center">
                                    <FileText className="w-12 h-12 mb-2 text-gray-400" />
                                    <p>No requests found</p>
                                </div>
                            </td>
                        </tr>
                    ) : (
                        requests.map((request) => (
                            <tr key={request.id} className={`hover:bg-gray-50 ${activeSubTab === 'cancelled' ? 'bg-gray-50 opacity-75' : ''}`}>
                                {activeTab === 'all' && (
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                                        {request.trip_ticket_number
                                            ? activeSubTab === 'cancelled'
                                                ? <span className="text-gray-400">{request.trip_ticket_number}</span>
                                                : activeSubTab === 'completed'
                                                    ? <span className="text-purple-600">{request.trip_ticket_number}</span>
                                                    : <span className="text-blue-600">{request.trip_ticket_number}</span>
                                            : <span className="text-gray-400">No ticket</span>
                                        }
                                    </td>
                                )}
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {request.user?.name || 'N/A'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {request.driver?.name || 'Not assigned'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {request.vehicle?.plate_number || 'Not assigned'}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                                    {request.destination}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    <div>{formatDate(request.date_of_travel)}</div>
                                    <div className="text-xs text-gray-500">{formatTime(request.time_of_travel)}</div>
                                </td>
                                {activeSubTab === 'cancelled' && (
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {request.cancelled_at
                                            ? format(new Date(request.cancelled_at), 'MMM d, yyyy h:mm a')
                                            : '—'
                                        }
                                    </td>
                                )}
                                {showActions && (
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {activeTab === 'pending' ? (
                                            <button
                                                onClick={() => openModal(request)}
                                                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                                disabled={processing}
                                            >
                                                <FileText className="w-4 h-4" />
                                                Assign Ticket
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => openViewModal(request)}
                                                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                                disabled={processing}
                                            >
                                                <FileText className="w-4 h-4" />
                                                View Ticket
                                            </button>
                                        )}
                                    </td>
                                )}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );

    return (
        <AuthenticatedLayout
            header={
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Trip Ticket Management</h2>
                    </div>
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md shadow-sm transition-colors"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Create Trip Ticket
                    </button>
                </div>
            }
        >
            <Head title="Trip Ticket Management" />
            
            {/* Success Message Banner */}
            {showSuccessMessage && (
                <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <div className="flex-1">
                            <p className="text-sm font-medium text-green-900">Trip ticket created successfully!</p>
                            <p className="text-sm text-green-700">The ticket has been sent to the Assignment Admin.</p>
                        </div>
                        <button
                            onClick={() => setShowSuccessMessage(false)}
                            className="text-green-600 hover:text-green-800"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
            
            <div className="py-0 max-w-full">
                <div className="mb-0">
                    <div className="border-b border-gray-200">
                        <nav className="-mb-px flex gap-4 px-6">
                            <button
                                onClick={() => setActiveTab('pending')}
                                className={`
                                    py-4 px-6 text-sm font-medium border-b-2 transition-colors
                                    ${activeTab === 'pending'
                                        ? 'border-blue-500 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }
                                `}
                            >
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4" />
                                    <span>Awaiting Ticket Number Assignment</span>
                                    <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs font-semibold">
                                        {pendingRequests.length}
                                    </span>
                                </div>
                            </button>
                            
                            <button
                                onClick={() => setActiveTab('all')}
                                className={`
                                    py-4 px-6 text-sm font-medium border-b-2 transition-colors
                                    ${activeTab === 'all'
                                        ? 'border-green-500 text-green-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }
                                `}
                            >
                                <div className="flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4" />
                                    <span>List of All Tickets</span>
                                    <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-xs font-semibold">
                                        {allTickets.length + completedTickets.length + cancelledRequests.length}
                                    </span>
                                </div>
                            </button>
                        </nav>
                    </div>
                </div>

                {activeTab === 'all' && (
                    <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
                        <div className="flex flex-col gap-4">
                            {/* Sub-tabs */}
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setActiveSubTab('active')}
                                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                                        activeSubTab === 'active'
                                            ? 'bg-green-600 text-white'
                                            : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-100'
                                    }`}
                                >
                                    Active
                                    <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs font-semibold ${
                                        activeSubTab === 'active' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700'
                                    }`}>
                                        {filteredTickets.length}
                                    </span>
                                </button>
                                <button
                                    onClick={() => setActiveSubTab('completed')}
                                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                                        activeSubTab === 'completed'
                                            ? 'bg-purple-600 text-white'
                                            : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-100'
                                    }`}
                                >
                                    Completed
                                    <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs font-semibold ${
                                        activeSubTab === 'completed' ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-700'
                                    }`}>
                                        {filteredCompletedTickets.length}
                                    </span>
                                </button>
                                <button
                                    onClick={() => setActiveSubTab('cancelled')}
                                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                                        activeSubTab === 'cancelled'
                                            ? 'bg-gray-600 text-white'
                                            : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-100'
                                    }`}
                                >
                                    Cancelled
                                    <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs font-semibold ${
                                        activeSubTab === 'cancelled' ? 'bg-gray-500 text-white' : 'bg-gray-100 text-gray-700'
                                    }`}>
                                        {filteredCancelledTickets.length}
                                    </span>
                                </button>
                            </div>
                            {/* Search Bar Row */}
                            <div className="flex-1">
                                <label htmlFor="search" className="sr-only">Search tickets</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                    </div>
                                    <input
                                        type="text"
                                        id="search"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                        placeholder="Search by ticket #, requestor, driver, vehicle, or destination..."
                                    />
                                </div>
                            </div>

                            {/* Filter and Export Row */}
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-3 flex-1">
                                    <label className="text-sm font-medium text-gray-700">Filter:</label>
                                    
                                    <select
                                        value={selectedMonth}
                                        onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                                        disabled={allTime}
                                        className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                                    >
                                        {months.map(month => (
                                            <option key={month.value} value={month.value}>
                                                {month.label}
                                            </option>
                                        ))}
                                    </select>

                                    <select
                                        value={selectedYear}
                                        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                        disabled={allTime}
                                        className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                                    >
                                        {availableYears.length > 0 ? (
                                            availableYears.map(year => (
                                                <option key={year} value={year}>
                                                    {year}
                                                </option>
                                            ))
                                        ) : (
                                            <option value={new Date().getFullYear()}>
                                                {new Date().getFullYear()}
                                            </option>
                                        )}
                                    </select>

                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={allTime}
                                            onChange={(e) => setAllTime(e.target.checked)}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-sm font-medium text-gray-700">All Time</span>
                                    </label>

                                    <div className="text-sm text-gray-600 ml-2">
                                        Showing <span className="font-semibold">{filteredTickets.length + filteredCompletedTickets.length + filteredCancelledTickets.length}</span> of <span className="font-semibold">{allTickets.length + completedTickets.length + cancelledRequests.length}</span> tickets
                                    </div>
                                </div>
                                
                                <button
                                    onClick={handleExportExcel}
                                    disabled={exporting || (filteredTickets.length === 0 && filteredCompletedTickets.length === 0 && filteredCancelledTickets.length === 0)}
                                    className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {exporting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Exporting...
                                        </>
                                    ) : (
                                        <>
                                            <Download className="w-4 h-4 mr-2" />
                                            Export to Excel
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="mt-0">
                    {activeTab === 'pending' && renderTable(pendingRequests)}
                    {activeTab === 'all' && activeSubTab === 'active' && renderTable(sortedTickets)}
                    {activeTab === 'all' && activeSubTab === 'completed' && renderTable(sortedCompletedTickets)}
                    {activeTab === 'all' && activeSubTab === 'cancelled' && renderTable(sortedCancelledTickets, false)}
                </div>
            </div>

            <RequestDetailsModal
                isOpen={isModalOpen}
                closeModal={() => {
                    setIsModalOpen(false);
                    setSelectedRequest(null);
                    setTicketNumber('');
                }}
                request={selectedRequest}
                onSubmit={handleSubmit}
                ticketNumber={ticketNumber}
                setTicketNumber={setTicketNumber}
                processing={processing}
            />

            <TripTicketPreviewModal
                isOpen={isPreviewModalOpen}
                closeModal={() => {
                    setIsPreviewModalOpen(false);
                    setPreviewRequest(null);
                }}
                request={previewRequest}
                onSend={previewRequest?.is_new_ticket ? handleConfirmCreateTicket : handleSendToAssignmentAdmin}
                sending={sending}
                onBack={handleBackToEdit}
            />

            <TripTicketViewModal
                isOpen={isViewModalOpen}
                closeModal={() => {
                    setIsViewModalOpen(false);
                    setViewRequest(null);
                }}
                request={viewRequest}
            />

            <CreateTripTicketModal
                isOpen={isCreateModalOpen}
                closeModal={() => {
                    setIsCreateModalOpen(false);
                    setSavedFormData(null);
                }}
                onPreview={handlePreviewNewTicket}
                processing={creatingTicket}
                initialData={savedFormData}
            />
        </AuthenticatedLayout>
    );
}