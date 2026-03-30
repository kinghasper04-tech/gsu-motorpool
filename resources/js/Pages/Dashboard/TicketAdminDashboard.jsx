import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import { FileText, Printer, Send, CheckCircle, Clock, Calendar, AlertCircle } from 'lucide-react';
import CalendarWidget from '@/Components/CalendarWidget';
import EmptyState from '@/Components/EmptyState';

export default function TicketAdminDashboard({ data }) {
    const formatDateTime = (dateStr) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    };

    return (
        <AuthenticatedLayout>
            <Head title="Ticket Dashboard" />
            
            <div className="py-10 bg-gray-50 min-h-[calc(100vh-80px)]">
                <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">
                    <div className="space-y-6">
                        {/* Stats Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <StatCard
                                title="Pending Tickets"
                                value={data.pendingTickets}
                                icon={Clock}
                                color="amber"
                                subtitle="Need generation"
                            />
                            <StatCard
                                title="Generated Today"
                                value={data.generatedToday}
                                icon={Printer}
                                color="green"
                                subtitle="Tickets created"
                            />
                            <StatCard
                                title="Sent Today"
                                value={data.sentToday}
                                icon={Send}
                                color="blue"
                                subtitle="Notifications sent"
                            />
                            <StatCard
                                title="Total Tickets"
                                value={data.totalTickets}
                                icon={FileText}
                                color="purple"
                                subtitle="All time"
                            />
                        </div>

                        {/* Main Content Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Pending Tickets Queue - 2 columns */}
                            <div className="lg:col-span-2 space-y-6">
                                <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                                    <div className="bg-gradient-to-r from-amber-50 to-orange-100 px-6 py-4 border-b border-amber-200">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h3 className="text-lg font-bold text-gray-900">Pending Ticket Generation</h3>
                                                <p className="text-sm text-gray-600 mt-0.5">
                                                    {data.pendingQueue?.length || 0} request{data.pendingQueue?.length !== 1 ? 's' : ''} need trip tickets
                                                </p>
                                            </div>
                                            <Link
                                                href={route('tickets.pending-requests')}
                                                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm font-medium"
                                            >
                                                View All
                                            </Link>
                                        </div>
                                    </div>
                                    <div className="p-6">
                                        {data.pendingQueue && data.pendingQueue.length > 0 ? (
                                            <div className="space-y-3">
                                                {data.pendingQueue.map((request, idx) => (
                                                    <div
                                                        key={request.id}
                                                        className={`block border rounded-lg p-4 transition-all duration-200 ${
                                                            request.is_imminent
                                                                ? 'border-red-300 bg-red-50 shadow-md'
                                                                : 'border-gray-200 bg-gradient-to-r from-white to-gray-50 hover:border-blue-300 hover:shadow-md'
                                                        }`}
                                                        style={{
                                                            animation: `slideIn 0.3s ease-out ${idx * 0.05}s both`
                                                        }}
                                                    >
                                                        <div className="flex items-start justify-between mb-2">
                                                            <div className="flex-1 min-w-0">
                                                                <h4 className="font-semibold text-gray-900 truncate">
                                                                    {request.requester}
                                                                </h4>
                                                                <p className="text-sm text-gray-600 mt-0.5 truncate">
                                                                    {request.destination}
                                                                </p>
                                                            </div>
                                                            {request.is_imminent ? (
                                                                <span className="text-xs font-bold text-red-700 bg-red-200 px-2 py-1 rounded-full flex items-center gap-1 flex-shrink-0 ml-2">
                                                                    <AlertCircle className="w-3 h-3" />
                                                                    Imminent
                                                                </span>
                                                            ) : request.days_waiting > 2 && (
                                                                <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-full flex-shrink-0 ml-2">
                                                                    {request.days_waiting}d waiting
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-3 mb-3">
                                                            <div className="text-xs">
                                                                <span className="text-gray-500">Vehicle:</span>
                                                                <p className="font-medium text-gray-700 truncate">{request.vehicle}</p>
                                                            </div>
                                                            <div className="text-xs">
                                                                <span className="text-gray-500">Driver:</span>
                                                                <p className="font-medium text-gray-700 truncate">{request.driver}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3 text-xs text-gray-500">
                                                            <span className="flex items-center gap-1">
                                                                <Calendar className="w-3.5 h-3.5" />
                                                                {request.date_of_travel}
                                                            </span>
                                                            <span className="text-gray-400">•</span>
                                                            <span>{request.time_of_travel}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <EmptyState
                                                icon={CheckCircle}
                                                title="All tickets generated!"
                                                description="There are no approved requests pending ticket generation."
                                            />
                                        )}
                                    </div>
                                </div>
                                
                                {/* Calendar Widget */}
                                <CalendarWidget userRole="ticket_admin" />
                            </div>

                            {/* Right Column */}
                            <div className="space-y-6">
                                {/* Recent Tickets */}
                                <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                                    <div className="bg-gradient-to-r from-green-50 to-emerald-100 px-6 py-4 border-b border-green-200">
                                        <h3 className="text-lg font-bold text-gray-900">Recent Tickets</h3>
                                        <p className="text-sm text-gray-600 mt-0.5">Latest generated</p>
                                    </div>
                                    <div className="p-6">
                                        {data.recentTickets && data.recentTickets.length > 0 ? (
                                            <div className="space-y-3">
                                                {data.recentTickets.map((ticket, idx) => (
                                                    <div
                                                        key={ticket.id}
                                                        className="border-l-4 border-green-500 bg-green-50 rounded-r-lg p-3"
                                                        style={{
                                                            animation: `slideIn 0.3s ease-out ${idx * 0.1}s both`
                                                        }}
                                                    >
                                                        <div className="flex items-start justify-between mb-1">
                                                            <h4 className="font-semibold text-gray-900 text-sm">
                                                                {ticket.trip_ticket_number}
                                                            </h4>
                                                            {ticket.sent && (
                                                                <span className="text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                                    <Send className="w-3 h-3" />
                                                                    Sent
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-gray-600 truncate mb-1">
                                                            {ticket.requester} → {ticket.destination}
                                                        </p>
                                                        <div className="text-xs text-gray-500 space-y-0.5">
                                                            <p>🚗 {ticket.vehicle}</p>
                                                            <p>👤 {ticket.driver}</p>
                                                        </div>
                                                        <p className="text-xs text-gray-500 mt-2">
                                                            {ticket.generated_at}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <EmptyState
                                                icon={Printer}
                                                title="No tickets yet"
                                                description="Recently generated tickets will appear here."
                                            />
                                        )}
                                    </div>
                                </div>

                                {/* Upcoming Trips */}
                                <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                                    <div className="bg-gradient-to-r from-blue-50 to-indigo-100 px-6 py-4 border-b border-blue-200">
                                        <h3 className="text-lg font-bold text-gray-900">Upcoming Trips</h3>
                                        <p className="text-sm text-gray-600 mt-0.5">Next departures</p>
                                    </div>
                                    <div className="p-6">
                                        {data.upcomingTrips && data.upcomingTrips.length > 0 ? (
                                            <div className="space-y-3">
                                                {data.upcomingTrips.map((trip, idx) => (
                                                    <div
                                                        key={trip.id}
                                                        className="border-l-4 border-blue-500 bg-blue-50 rounded-r-lg p-3"
                                                        style={{
                                                            animation: `slideIn 0.3s ease-out ${idx * 0.1}s both`
                                                        }}
                                                    >
                                                        <div className="flex items-start justify-between mb-1">
                                                            <h4 className="font-semibold text-gray-900 text-sm">
                                                                {trip.trip_ticket_number}
                                                            </h4>
                                                            {trip.days_until >= 0 && trip.days_until <= 2 && (
                                                                <span className="text-xs font-bold text-blue-700 bg-blue-200 px-2 py-0.5 rounded-full">
                                                                    {trip.days_until === 0 ? 'Today' : `${trip.days_until}d`}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-gray-600 truncate mb-1">
                                                            {trip.requester} → {trip.destination}
                                                        </p>
                                                        <p className="text-xs text-gray-500 flex items-center gap-1">
                                                            <Calendar className="w-3.5 h-3.5" />
                                                            {trip.start_datetime}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <EmptyState
                                                icon={Calendar}
                                                title="No upcoming trips"
                                                description="Scheduled trips will appear here."
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <style>{`
                            @keyframes slideIn {
                                from {
                                    opacity: 0;
                                    transform: translateY(10px);
                                }
                                to {
                                    opacity: 1;
                                    transform: translateY(0);
                                }
                            }
                        `}</style>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

// Stat Card Component
function StatCard({ title, value, icon: Icon, color, subtitle, link }) {
    const colorClasses = {
        amber: 'from-amber-500 to-orange-600',
        green: 'from-green-500 to-emerald-600',
        blue: 'from-blue-500 to-indigo-600',
        purple: 'from-purple-500 to-indigo-600',
    };

    const content = (
        <div className={`bg-gradient-to-br ${colorClasses[color]} p-4`}>
            <div className="flex items-center justify-between">
                <div className="flex-1">
                    <p className="text-white/90 text-sm font-medium mb-1">{title}</p>
                    <p className="text-white text-3xl font-bold">{value}</p>
                    <p className="text-white/80 text-xs mt-1">{subtitle}</p>
                </div>
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                    <Icon className="w-6 h-6 text-white" />
                </div>
            </div>
        </div>
    );

    return link ? (
        <Link
            href={link}
            className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-200 transform hover:scale-105 block"
        >
            {content}
        </Link>
    ) : (
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
            {content}
        </div>
    );
}