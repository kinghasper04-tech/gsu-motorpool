import React, { useState } from "react";
import { Head } from "@inertiajs/react";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { format } from "date-fns";
import { FileText, Download, Eye, Printer, Search, ChevronDown } from "lucide-react";

export default function DriversTickets({ auth, tickets }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDriver, setFilterDriver] = useState('all');

    const formatDate = (dateString) => {
        return format(new Date(dateString), 'MMMM d, yyyy');
    };

    const formatTime = (timeString) => {
        return format(new Date(`2000-01-01 ${timeString}`), 'h:mm a');
    };

    const uniqueDrivers = [...new Set(tickets.map(t => t.driver?.name).filter(Boolean))];

    const filteredTickets = tickets.filter(ticket => {
        const matchesSearch =
            ticket.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            ticket.driver?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            ticket.trip_ticket_number.toString().includes(searchTerm) ||
            ticket.destination.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesDriver = filterDriver === 'all' || ticket.driver?.name === filterDriver;

        return matchesSearch && matchesDriver;
    });

    const handlePreview = (ticketId) => {
        window.open(route('tickets.preview', ticketId), '_blank');
    };

    const handleDownload = (ticketId) => {
        window.location.href = route('tickets.download', ticketId);
    };

    const handlePrint = (ticketId) => {
        const printWindow = window.open(route('tickets.preview', ticketId), '_blank');
        printWindow.addEventListener('load', () => {
            printWindow.print();
        });
    };

    return (
        <AuthenticatedLayout
            user={auth.user}
            header={
                <h2 className="font-semibold text-xl text-gray-800 leading-tight">
                    Driver's Tickets
                </h2>
            }
        >
            <Head title="Driver's Tickets" />

            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">

                {/* Stats Cards */}
                <div className="grid grid-cols-3 gap-3 sm:gap-6">
                    <div className="bg-white rounded-lg shadow p-3 sm:p-6">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-0">
                            <div className="p-2 sm:p-3 bg-blue-100 rounded-lg w-fit">
                                <FileText className="w-4 h-4 sm:w-6 sm:h-6 text-blue-600" />
                            </div>
                            <div className="sm:ml-4">
                                <p className="text-xs sm:text-sm font-medium text-gray-600">Total</p>
                                <p className="text-xl sm:text-2xl font-bold text-gray-900">{tickets.length}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow p-3 sm:p-6">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-0">
                            <div className="p-2 sm:p-3 bg-green-100 rounded-lg w-fit">
                                <FileText className="w-4 h-4 sm:w-6 sm:h-6 text-green-600" />
                            </div>
                            <div className="sm:ml-4">
                                <p className="text-xs sm:text-sm font-medium text-gray-600">Drivers</p>
                                <p className="text-xl sm:text-2xl font-bold text-gray-900">{uniqueDrivers.length}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow p-3 sm:p-6">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-0">
                            <div className="p-2 sm:p-3 bg-purple-100 rounded-lg w-fit">
                                <FileText className="w-4 h-4 sm:w-6 sm:h-6 text-purple-600" />
                            </div>
                            <div className="sm:ml-4">
                                <p className="text-xs sm:text-sm font-medium text-gray-600">Filtered</p>
                                <p className="text-xl sm:text-2xl font-bold text-gray-900">{filteredTickets.length}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-lg shadow p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search requestor, driver, ticket #, destination..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            />
                        </div>

                        <div className="relative">
                            <select
                                value={filterDriver}
                                onChange={(e) => setFilterDriver(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm appearance-none"
                            >
                                <option value="all">All Drivers</option>
                                {uniqueDrivers.map((driver) => (
                                    <option key={driver} value={driver}>{driver}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        </div>
                    </div>
                </div>

                {/* ── MOBILE: Card list ── */}
                <div className="sm:hidden space-y-3">
                    {filteredTickets.length === 0 ? (
                        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                            <FileText className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                            <p className="text-sm">No tickets found matching your criteria</p>
                        </div>
                    ) : (
                        filteredTickets.map((ticket) => (
                            <div key={ticket.id} className="bg-white rounded-lg shadow p-4 space-y-3">
                                {/* Header */}
                                <div className="flex items-start justify-between">
                                    <div>
                                        <span className="text-sm font-bold text-blue-600">
                                            #{ticket.trip_ticket_number}
                                        </span>
                                        <p className="text-sm font-semibold text-gray-900 mt-0.5">
                                            {ticket.destination}
                                        </p>
                                    </div>
                                    <span className="text-xs text-gray-500 flex-shrink-0 ml-2 mt-0.5">
                                        {formatDate(ticket.date_of_travel)}
                                    </span>
                                </div>

                                {/* Details */}
                                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                                    <div>
                                        <span className="font-medium text-gray-500">Requestor</span>
                                        <p className="text-gray-900">{ticket.user.name}</p>
                                    </div>
                                    <div>
                                        <span className="font-medium text-gray-500">Time</span>
                                        <p className="text-gray-900">{formatTime(ticket.time_of_travel)}</p>
                                    </div>
                                    <div>
                                        <span className="font-medium text-gray-500">Driver</span>
                                        <p className="text-gray-900">{ticket.driver?.name || 'Not assigned'}</p>
                                    </div>
                                    <div>
                                        <span className="font-medium text-gray-500">Vehicle</span>
                                        <p className="text-gray-900">
                                            {ticket.vehicle?.plate_number || 'N/A'}
                                        </p>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2 pt-1 border-t border-gray-100">
                                    <button
                                        onClick={() => handlePreview(ticket.id)}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-medium rounded-lg transition-colors"
                                    >
                                        <Eye className="w-3.5 h-3.5" />
                                        Preview
                                    </button>
                                    <button
                                        onClick={() => handleDownload(ticket.id)}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-medium rounded-lg transition-colors"
                                    >
                                        <Download className="w-3.5 h-3.5" />
                                        Download
                                    </button>
                                    <button
                                        onClick={() => handlePrint(ticket.id)}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-medium rounded-lg transition-colors"
                                    >
                                        <Printer className="w-3.5 h-3.5" />
                                        Print
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* ── DESKTOP: Table ── */}
                <div className="hidden sm:block bg-white rounded-lg shadow overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50 text-left">
                                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                                        Trip Ticket #
                                    </th>
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
                                        Travel Date & Time
                                    </th>
                                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                                        Destination
                                    </th>
                                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {filteredTickets.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                                            <div className="flex flex-col items-center justify-center">
                                                <FileText className="w-12 h-12 mb-2 text-gray-400" />
                                                <p>No tickets found matching your criteria</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredTickets.map((ticket) => (
                                        <tr key={ticket.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-600">
                                                #{ticket.trip_ticket_number}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {ticket.user.name}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {ticket.driver?.name || 'Not assigned'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                <div>{ticket.vehicle?.description || 'N/A'}</div>
                                                <div className="text-xs text-gray-500">
                                                    {ticket.vehicle?.plate_number || 'N/A'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                <div>{formatDate(ticket.date_of_travel)}</div>
                                                <div className="text-xs text-gray-500">
                                                    {formatTime(ticket.time_of_travel)}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                                                {ticket.destination}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handlePreview(ticket.id)}
                                                        className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
                                                        title="Preview Ticket"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDownload(ticket.id)}
                                                        className="p-2 bg-green-500 hover:bg-green-600 text-white rounded transition-colors"
                                                        title="Download Ticket"
                                                    >
                                                        <Download className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handlePrint(ticket.id)}
                                                        className="p-2 bg-purple-500 hover:bg-purple-600 text-white rounded transition-colors"
                                                        title="Print Ticket"
                                                    >
                                                        <Printer className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}