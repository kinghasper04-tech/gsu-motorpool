import { useState, useEffect } from 'react';
import { Head, router } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Bell, Trash2, Check, Filter } from 'lucide-react';
import axios from 'axios';

export default function NotificationsPage({ auth }) {
    const [notifications, setNotifications] = useState([]);
    const [filter, setFilter] = useState('all'); // 'all', 'unread', 'read'
    const [loading, setLoading] = useState(true);

    // Fetch notifications
    const fetchNotifications = async () => {
        setLoading(true);
        try {
            const response = await axios.get('/api/notifications');
            setNotifications(response.data.notifications);
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNotifications();
    }, []);

    // Filter notifications
    const filteredNotifications = notifications.filter(notification => {
        if (filter === 'unread') return !notification.read;
        if (filter === 'read') return notification.read;
        return true;
    });

    // Mark as read
    const markAsRead = async (notificationId) => {
        try {
            await axios.post(`/api/notifications/${notificationId}/read`);
            fetchNotifications();
        } catch (error) {
            console.error('Failed to mark as read:', error);
        }
    };

    // Mark all as read
    const markAllAsRead = async () => {
        try {
            await axios.post('/api/notifications/mark-all-read');
            fetchNotifications();
        } catch (error) {
            console.error('Failed to mark all as read:', error);
        }
    };

    // Delete notification
    const deleteNotification = async (notificationId) => {
        try {
            await axios.delete(`/api/notifications/${notificationId}`);
            fetchNotifications();
        } catch (error) {
            console.error('Failed to delete notification:', error);
        }
    };

    // Clear all read notifications
    const clearReadNotifications = async () => {
        if (!confirm('Are you sure you want to clear all read notifications?')) return;
        
        try {
            await axios.post('/api/notifications/clear-read');
            fetchNotifications();
        } catch (error) {
            console.error('Failed to clear notifications:', error);
        }
    };

    // Handle notification click
    const handleNotificationClick = (notification) => {
        if (!notification.read) {
            markAsRead(notification.id);
        }
        
        if (notification.action_url) {
            router.visit(notification.action_url);
        }
    };

    // Format date
    const formatDate = (date) => {
        return new Date(date).toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Get notification icon
    const getNotificationIcon = (type) => {
        switch (type) {
            case 'request_submitted':
                return '📝';
            case 'request_assigned':
                return '🚗';
            case 'request_approved':
                return '✅';
            case 'request_declined':
                return '❌';
            case 'ticket_preparation':
                return '🎫';
            case 'ticket_generated':
                return '🎫';
            case 'trip_assigned':
                return '🚗';
            case 'request_cancelled':
                return '🚫';
            default:
                return '🔔';
        }
    };

    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <AuthenticatedLayout 
            user={auth.user}
            header={
                <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
            }
        >
            <Head title="Notifications" />

            <div className="py-6">
                <div className="max-w-5xl mx-auto sm:px-6 lg:px-8">
                    {/* Header */}
                    <div className="bg-white shadow rounded-lg p-6 mb-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <Bell className="w-8 h-8 text-blue-600" />
                                <div>
                                    
                                    <p className="text-sm text-gray-600">
                                        {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                {unreadCount > 0 && (
                                    <button
                                        onClick={markAllAsRead}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition flex items-center gap-2"
                                    >
                                        <Check className="w-4 h-4" />
                                        Mark all read
                                    </button>
                                )}
                                <button
                                    onClick={clearReadNotifications}
                                    className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition flex items-center gap-2"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Clear read
                                </button>
                            </div>
                        </div>

                        {/* Filter Tabs */}
                        <div className="flex gap-2 border-b border-gray-200">
                            <button
                                onClick={() => setFilter('all')}
                                className={`px-4 py-2 font-medium transition ${
                                    filter === 'all'
                                        ? 'border-b-2 border-blue-600 text-blue-600'
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                All ({notifications.length})
                            </button>
                            <button
                                onClick={() => setFilter('unread')}
                                className={`px-4 py-2 font-medium transition ${
                                    filter === 'unread'
                                        ? 'border-b-2 border-blue-600 text-blue-600'
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                Unread ({unreadCount})
                            </button>
                            <button
                                onClick={() => setFilter('read')}
                                className={`px-4 py-2 font-medium transition ${
                                    filter === 'read'
                                        ? 'border-b-2 border-blue-600 text-blue-600'
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                Read ({notifications.length - unreadCount})
                            </button>
                        </div>
                    </div>

                    {/* Notifications List */}
                    <div className="bg-white shadow rounded-lg overflow-hidden">
                        {loading ? (
                            <div className="p-8 text-center text-gray-500">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                                <p className="mt-4">Loading notifications...</p>
                            </div>
                        ) : filteredNotifications.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">
                                <Bell className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                                <p className="text-lg">No {filter !== 'all' ? filter : ''} notifications</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-200">
                                {filteredNotifications.map((notification) => (
                                    <div
                                        key={notification.id}
                                        onClick={() => handleNotificationClick(notification)}
                                        className={`p-6 cursor-pointer transition ${
                                            !notification.read
                                                ? 'bg-blue-50 hover:bg-blue-100'
                                                : 'hover:bg-gray-50'
                                        }`}
                                    >
                                        <div className="flex items-start gap-4">
                                            {/* Icon */}
                                            <div className="text-3xl flex-shrink-0">
                                                {getNotificationIcon(notification.type)}
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div>
                                                        <h3 className={`text-lg font-medium text-gray-900 ${
                                                            !notification.read ? 'font-semibold' : ''
                                                        }`}>
                                                            {notification.title}
                                                        </h3>
                                                        <p className="text-gray-700 mt-1 whitespace-pre-line">
                                                            {notification.message}
                                                        </p>
                                                        <p className="text-sm text-gray-500 mt-2">
                                                            {formatDate(notification.created_at)}
                                                        </p>
                                                    </div>

                                                    {/* Actions */}
                                                    <div className="flex items-center gap-2 flex-shrink-0">
                                                        {!notification.read && (
                                                            <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                                                        )}
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                deleteNotification(notification.id);
                                                            }}
                                                            className="p-2 text-gray-400 hover:text-red-600 transition rounded hover:bg-red-50"
                                                        >
                                                            <Trash2 className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}