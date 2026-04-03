import { useState, useCallback } from 'react';
import { Head } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import RequestDetailModal from './RequestDetailModal';
import { Calendar, Clock, MapPin, User } from 'lucide-react';
import axios from 'axios';
import { format, isToday, startOfDay } from 'date-fns';

// ── Config ────────────────────────────────────────────────────────────────────

const STATUS = {
    pending:   { label: 'Pending',   color: '#f59e0b' },
    assigned:  { label: 'Assigned',  color: '#3b82f6' },
    approved:  { label: 'Approved',  color: '#10b981' },
    declined:  { label: 'Declined',  color: '#ef4444' },
    completed: { label: 'Completed', color: '#8b5cf6' },
};

const ROLE_STATUSES = {
    client:           ['approved', 'completed'],
    assignment_admin: ['assigned', 'approved', 'completed'],
    approval_admin:   ['assigned', 'approved', 'completed'],
    ticket_admin:     ['approved', 'completed'],
};

const ROLE_TITLE = {
    client:           'My Trips',
    assignment_admin: 'Assignment Calendar',
    approval_admin:   'Approval Calendar',
    ticket_admin:     'Ticket Calendar',
};

function getAllowedStatuses(role) {
    return ROLE_STATUSES[role] ?? ['approved', 'completed'];
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Dot({ color, size = 10 }) {
    return (
        <span
            style={{ width: size, height: size, borderRadius: '50%', backgroundColor: color, display: 'inline-block', flexShrink: 0 }}
        />
    );
}

function Badge({ status }) {
    const cfg = STATUS[status];
    return (
        <span style={{
            fontSize: 11, fontWeight: 600, padding: '2px 8px',
            borderRadius: 99, color: '#fff', backgroundColor: cfg?.color,
        }}>
            {cfg?.label}
        </span>
    );
}

function TripCard({ event, isAdmin, onClick }) {
    const status = event.extendedProps?.status;
    return (
        <button
            onClick={onClick}
            style={{
                width: '100%', textAlign: 'left', padding: '10px 12px',
                borderRadius: 10, border: '1px solid #f0f0f0',
                background: '#fff', cursor: 'pointer', transition: 'box-shadow .15s',
                display: 'flex', flexDirection: 'column', gap: 4,
            }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,.08)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500 }}>
                    {format(new Date(event.start), 'MMM d, yyyy')}
                </span>
                <Badge status={status} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <MapPin size={12} color="#9ca3af" />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {event.extendedProps?.destination}
                </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Clock size={11} color="#9ca3af" />
                <span style={{ fontSize: 12, color: '#6b7280' }}>
                    {format(new Date(event.start), 'h:mm a')}
                </span>
                {isAdmin && event.extendedProps?.requester && (
                    <>
                        <User size={11} color="#9ca3af" style={{ marginLeft: 6 }} />
                        <span style={{ fontSize: 12, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {event.extendedProps.requester}
                        </span>
                    </>
                )}
            </div>
        </button>
    );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function CalendarIndex({ auth, userRole }) {
    const allowedStatuses = getAllowedStatuses(userRole);

    const [allEvents, setAllEvents]           = useState([]);
    const [activeFilters, setActiveFilters]   = useState(new Set(allowedStatuses));
    const [viewDates, setViewDates]           = useState({ start: null, end: null });
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [isModalOpen, setIsModalOpen]       = useState(false);
    const [loading, setLoading]               = useState(false);

    // Derived
    const filteredEvents = allEvents.filter(e => activeFilters.has(e.extendedProps?.status));

    const inView = (e) =>
        viewDates.start &&
        new Date(e.start) >= new Date(viewDates.start) &&
        new Date(e.start) <= new Date(viewDates.end);

    const todayTrips = filteredEvents.filter(e => isToday(new Date(e.start)));

    const upcomingTrips = filteredEvents
        .filter(e => new Date(e.start) >= startOfDay(new Date()) && inView(e))
        .sort((a, b) => new Date(a.start) - new Date(b.start));

    const counts = allowedStatuses.reduce((acc, s) => {
        acc[s] = allEvents.filter(e => e.extendedProps?.status === s && inView(e)).length;
        return acc;
    }, {});

    // Handlers
    const fetchEvents = useCallback(async (info, success, fail) => {
        try {
            const { data } = await axios.get('/calendar/events', {
                params: { start: info.startStr, end: info.endStr },
            });
            setAllEvents(data);
            success(data);
        } catch (err) { fail(err); }
    }, []);

    const openRequest = async (id) => {
        setLoading(true);
        try {
            const { data } = await axios.get(`/calendar/requests/${id}`);
            setSelectedRequest(data);
            setIsModalOpen(true);
        } catch { alert('Failed to load request details.'); }
        finally { setLoading(false); }
    };

    const toggleFilter = (status) => {
        setActiveFilters(prev => {
            const next = new Set(prev);
            if (next.has(status) && next.size > 1) next.delete(status);
            else next.add(status);
            return next;
        });
    };

    const isAdmin = userRole !== 'client';

    return (
        <AuthenticatedLayout
            user={auth.user}
            header={
                <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>
                    {ROLE_TITLE[userRole] ?? 'Calendar'}
                </h2>
            }
        >
            <Head title="Calendar" />

            <div style={{ padding: '24px 0' }}>
                <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px', display: 'flex', gap: 24, alignItems: 'flex-start' }}>

                    {/* ── Left: Calendar ── */}
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>

                        {/* Summary */}
                        <div style={card}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 24px', alignItems: 'center' }}>
                                <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: .5 }}>
                                    This view
                                </span>
                                {allowedStatuses.map(s => (
                                    <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <Dot color={STATUS[s].color} />
                                        <span style={{ fontSize: 13, color: '#374151' }}>
                                            <strong>{counts[s] ?? 0}</strong> {STATUS[s].label}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Today */}
                        {todayTrips.length > 0 && (
                            <div style={card}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                                    <Clock size={14} color="#3b82f6" />
                                    <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
                                        Today · {format(new Date(), 'MMMM d')}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                    {todayTrips.map(e => (
                                        <button
                                            key={e.id}
                                            onClick={() => openRequest(e.id)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 6,
                                                padding: '5px 12px', borderRadius: 99, border: 'none',
                                                color: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                                                backgroundColor: STATUS[e.extendedProps?.status]?.color,
                                            }}
                                        >
                                            <MapPin size={11} />
                                            {e.extendedProps?.destination ?? e.title}
                                            <span style={{ opacity: .75 }}>{format(new Date(e.start), 'h:mm a')}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* FullCalendar */}
                        <div style={{ ...card, padding: 20 }}>
                            <FullCalendar
                                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                                initialView="dayGridMonth"
                                headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
                                eventSources={[fetchEvents]}
                                events={filteredEvents}
                                eventClick={info => openRequest(info.event.id)}
                                datesSet={d => setViewDates({ start: d.startStr, end: d.endStr })}
                                height="auto"
                                nowIndicator
                                weekends
                                eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: true }}
                                slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: true }}
                                eventDisplay="block"
                                displayEventTime
                                displayEventEnd={false}
                                eventClassNames="cursor-pointer"
                            />
                        </div>

                        {/* Legend */}
                        <div style={card}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 20px' }}>
                                {allowedStatuses.map(s => (
                                    <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: STATUS[s].color, display: 'inline-block' }} />
                                        <span style={{ fontSize: 12, color: '#6b7280' }}>{STATUS[s].label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* ── Right: Sidebar ── */}
                    <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>

                        {/* Filters */}
                        <div style={card}>
                            <p style={sideLabel}>Filter by Status</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {allowedStatuses.map(s => {
                                    const active = activeFilters.has(s);
                                    return (
                                        <button
                                            key={s}
                                            onClick={() => toggleFilter(s)}
                                            style={{
                                                padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                                                border: `1px solid ${active ? STATUS[s].color : '#e5e7eb'}`,
                                                backgroundColor: active ? STATUS[s].color : '#fff',
                                                color: active ? '#fff' : '#9ca3af',
                                                transition: 'all .15s',
                                            }}
                                        >
                                            {STATUS[s].label}
                                        </button>
                                    );
                                })}
                            </div>
                            {activeFilters.size < allowedStatuses.length && (
                                <button
                                    onClick={() => setActiveFilters(new Set(allowedStatuses))}
                                    style={{ marginTop: 8, fontSize: 12, color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                                >
                                    Reset
                                </button>
                            )}
                        </div>

                        {/* Upcoming */}
                        <div style={card}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                <p style={{ ...sideLabel, margin: 0 }}>Upcoming Trips</p>
                                {upcomingTrips.length > 0 && (
                                    <span style={{ fontSize: 11, fontWeight: 700, backgroundColor: '#eff6ff', color: '#3b82f6', padding: '2px 8px', borderRadius: 99 }}>
                                        {upcomingTrips.length}
                                    </span>
                                )}
                            </div>

                            {upcomingTrips.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                                    <Calendar size={28} color="#d1d5db" style={{ margin: '0 auto 8px' }} />
                                    <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>No upcoming trips.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 480, overflowY: 'auto' }}>
                                    {upcomingTrips.map(e => (
                                        <TripCard
                                            key={e.id}
                                            event={e}
                                            isAdmin={isAdmin}
                                            onClick={() => openRequest(e.id)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Loading */}
            {loading && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
                }}>
                    <div style={{ background: '#fff', borderRadius: 12, padding: '24px 32px', textAlign: 'center' }}>
                        <div style={{
                            width: 36, height: 36, border: '3px solid #e5e7eb',
                            borderTop: '3px solid #3b82f6', borderRadius: '50%',
                            animation: 'spin 1s linear infinite', margin: '0 auto',
                        }} />
                        <p style={{ marginTop: 12, fontSize: 13, color: '#6b7280' }}>Loading…</p>
                    </div>
                </div>
            )}

            <RequestDetailModal
                isOpen={isModalOpen}
                closeModal={() => { setIsModalOpen(false); setSelectedRequest(null); }}
                request={selectedRequest}
                userRole={userRole}
            />

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </AuthenticatedLayout>
    );
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const card = {
    background: '#fff',
    borderRadius: 12,
    boxShadow: '0 1px 4px rgba(0,0,0,.06)',
    padding: '16px 20px',
};

const sideLabel = {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: .6,
    color: '#9ca3af',
    marginBottom: 10,
};