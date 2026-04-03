<?php

namespace App\Services;

use App\Models\User;
use App\Models\Notification;
use App\Models\Request as VehicleRequest;
use App\Mail\RequestApproved;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\URL;

class NotificationService
{
    /**
     * 1. CLIENT SUBMITS REQUEST
     * Notify: Assignment Admin
     */
    public function notifyAssignmentAdmin(VehicleRequest $request)
    {
        try {
            $assignmentAdmins = User::where('role', 'assignment_admin')->get();
            
            foreach ($assignmentAdmins as $admin) {
                // Create in-app notification
                Notification::create([
                    'user_id' => $admin->id,
                    'type' => 'request_submitted',
                    'title' => 'New Vehicle Request Submitted',
                    'message' => "{$request->user->name} submitted a new vehicle request for {$request->destination}.",
                    'data' => [
                        'request_id' => $request->id,
                        'requester_name' => $request->user->name,
                        'destination' => $request->destination,
                        'date_of_travel' => $request->date_of_travel->format('Y-m-d'),
                    ],
                    'action_url' => route('assignment.requests.index'),
                    'read' => false,
                ]);
            }

            Log::info('Assignment admins notified of new request', [
                'request_id' => $request->id,
                'notified_count' => $assignmentAdmins->count()
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to notify assignment admin', [
                'request_id' => $request->id,
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * 2. ASSIGNMENT ADMIN ASSIGNS VEHICLE/DRIVER
     * Notify: Approval Admin, Client
     */
    public function notifyApprovalAdmin(VehicleRequest $request)
    {
        try {
            $approvalAdmins = User::where('role', 'approval_admin')->get();
            
            foreach ($approvalAdmins as $admin) {
                Notification::create([
                    'user_id' => $admin->id,
                    'type' => 'request_assigned',
                    'title' => 'Request Ready for Approval',
                    'message' => "Request from {$request->user->name} has been assigned a vehicle and driver. Awaiting your approval.",
                    'data' => [
                        'request_id' => $request->id,
                        'requester_name' => $request->user->name,
                        'vehicle' => $request->vehicle->description ?? 'N/A',
                        'driver' => $request->driver->name ?? 'N/A',
                        'destination' => $request->destination,
                    ],
                    'action_url' => route('admin.requests.management'),
                    'read' => false,
                ]);
            }

            // Also notify the client that their request has been assigned
            $this->notifyClientAssignment($request);

            Log::info('Approval admins notified of assigned request', [
                'request_id' => $request->id,
                'notified_count' => $approvalAdmins->count()
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to notify approval admin', [
                'request_id' => $request->id,
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Notify client that their request has been assigned
     */
    private function notifyClientAssignment(VehicleRequest $request)
    {
        try {
            Notification::create([
                'user_id' => $request->user_id,
                'type' => 'request_assigned',
                'title' => 'Vehicle and Driver Assigned',
                'message' => "Your request for {$request->destination} has been assigned:\nVehicle: {$request->vehicle->description} ({$request->vehicle->plate_number})\nDriver: {$request->driver->name}",
                'data' => [
                    'request_id' => $request->id,
                    'vehicle_description' => $request->vehicle->description,
                    'vehicle_plate' => $request->vehicle->plate_number,
                    'driver_name' => $request->driver->name,
                ],
                'action_url' => route('requests.index') . '?tab=assigned',
                'read' => false,
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to notify client of assignment', [
                'request_id' => $request->id,
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * 3. APPROVAL ADMIN APPROVES/DECLINES
     * Notify: Client (in-app + email for approval)
     * Notify: Ticket Admin (if approved)
     */
    public function notifyClient(VehicleRequest $request, string $action, ?string $pdfPath = null)
    {
        try {
            if ($action === 'approved') {
                // Create in-app notification
                Notification::create([
                    'user_id' => $request->user_id,
                    'type' => 'request_approved',
                    'title' => '✅ Request Approved!',
                    'message' => "Great news! Your vehicle request for {$request->destination} has been approved. A trip ticket will be generated soon.",
                    'data' => [
                        'request_id' => $request->id,
                        'destination' => $request->destination,
                        'vehicle' => $request->vehicle->description ?? 'N/A',
                        'driver' => $request->driver->name ?? 'N/A',
                        'approved_by' => $request->approver->name ?? 'Admin',
                        'approved_at' => $request->approved_at->format('Y-m-d H:i:s'),
                    ],
                    'action_url' => route('requests.index') . '?tab=approved',
                    'read' => false,
                ]);

                // Send approval email with PDF attachment
                try {
                    Mail::to($request->user->email)->send(
                        new RequestApproved($request, $pdfPath)
                    );
                    
                    Log::info('Approval email sent successfully', [
                        'request_id' => $request->id,
                        'user_email' => $request->user->email,
                        'has_pdf' => !is_null($pdfPath)
                    ]);
                } catch (\Exception $e) {
                    Log::error('Failed to send approval email', [
                        'request_id' => $request->id,
                        'user_email' => $request->user->email,
                        'error' => $e->getMessage()
                    ]);
                    // Don't throw - we still want the in-app notification to work
                }

            } elseif ($action === 'declined') {
                Notification::create([
                    'user_id' => $request->user_id,
                    'type' => 'request_declined',
                    'title' => '❌ Request Declined',
                    'message' => "Your vehicle request for {$request->destination} has been declined.\n\nReason: {$request->decline_reason}",
                    'data' => [
                        'request_id' => $request->id,
                        'destination' => $request->destination,
                        'decline_reason' => $request->decline_reason,
                        'declined_by' => $request->decliner->name ?? 'Admin',
                        'declined_at' => $request->declined_at->format('Y-m-d H:i:s'),
                    ],
                    'action_url' => route('requests.index') . '?tab=declined',
                    'read' => false,
                ]);
            }

            Log::info("Client notified of request {$action}", [
                'request_id' => $request->id,
                'user_id' => $request->user_id
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to notify client', [
                'request_id' => $request->id,
                'action' => $action,
                'error' => $e->getMessage()
            ]);
        }
    }
    
    /**
     * CANCEL: Client cancels an assigned or approved request
     * Notify: Assignment Admin (if assigned), All Admins (if approved)
     */
    public function notifyCancellation(VehicleRequest $request): void
    {
        try {
            $roles = $request->status === VehicleRequest::STATUS_APPROVED
                ? ['assignment_admin', 'approval_admin', 'ticket_admin']
                : ['assignment_admin'];

            $hasTicket = !is_null($request->trip_ticket_number);

            $message = $hasTicket
                ? "{$request->user->name} cancelled their vehicle request for {$request->destination} (Request #{$request->id}). Trip ticket #{$request->trip_ticket_number} has been voided."
                : "{$request->user->name} cancelled their vehicle request for {$request->destination} (Request #{$request->id}). No trip ticket had been generated yet.";

            $admins = User::whereIn('role', $roles)->get();

            foreach ($admins as $admin) {
                Notification::create([
                    'user_id'    => $admin->id,
                    'type'       => 'request_cancelled',
                    'title'      => '🚫 Request Cancelled',
                    'message'    => $message,
                    'data'       => [
                        'request_id'        => $request->id,
                        'requester_name'    => $request->user->name,
                        'destination'       => $request->destination,
                        'cancelled_at'      => now()->format('Y-m-d H:i:s'),
                        'prior_status'      => $request->status,
                        'trip_ticket_number' => $request->trip_ticket_number,
                        'has_ticket'        => $hasTicket,
                    ],
                    
                    'action_url' => match($admin->role) {
                        'assignment_admin' => route('assignment.requests.index') . '?tab=cancelled',
                        'approval_admin'   => route('admin.requests.management') . '?tab=cancelled',
                        'ticket_admin'     => route('tickets.pending-requests') . '?tab=cancelled',
                        default            => route('assignment.requests.index') . '?tab=cancelled',
                    },
                    'read'       => false,
                ]);
            }

            Log::info('Admins notified of request cancellation', [
                'request_id'     => $request->id,
                'prior_status'   => $request->status,
                'has_ticket'     => $hasTicket,
                'notified_count' => $admins->count(),
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to notify admins of cancellation', [
                'request_id' => $request->id,
                'error'      => $e->getMessage(),
            ]);
        }
    }

    /**
     * Notify approval admin when a request is forwarded for decline
     */
    public function notifyApprovalAdminForDecline(VehicleRequest $request)
    {
        try {
            // Get approval/admin users
            $approvalAdmins = User::whereIn('role', ['approval_admin', 'admin'])->get();

            foreach ($approvalAdmins as $admin) {
                Notification::create([
                    'user_id' => $admin->id,
                    'type' => 'request_forwarded_for_decline',
                    'title' => 'Request Forwarded for Decline',
                    'message' => "Request #{$request->id} forwarded for decline. Reason: " . ($request->forwarded_decline_reason ?? 'No reason provided'),
                    'data' => [
                        'request_id' => $request->id,
                        'requester_name' => $request->user->name,
                        'destination' => $request->destination,
                        'forwarded_reason' => $request->forwarded_decline_reason,
                    ],
                    'action_url' => route('admin.requests.management') . '?tab=forwarded',
                    'read' => false,
                ]);
            }

            Log::info('Approval/admin users notified for forwarded decline request', [
                'request_id' => $request->id,
                'notified_count' => $approvalAdmins->count(),
            ]);
            
        } catch (\Exception $e) {
            Log::error('Failed to notify approval/admin users for forwarded decline', [
                'request_id' => $request->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * 4. NOTIFY TICKET ADMIN (After Approval)
     */
    public function notifyTicketAdmin(VehicleRequest $request)
    {
        try {
            $ticketAdmins = User::where('role', 'ticket_admin')->get();
            
            foreach ($ticketAdmins as $admin) {
                Notification::create([
                    'user_id' => $admin->id,
                    'type' => 'ticket_preparation',
                    'title' => 'Trip Ticket Preparation Needed',
                    'message' => "Request #{$request->id} has been approved. Please prepare the trip ticket for {$request->user->name}'s trip to {$request->destination}.",
                    'data' => [
                        'request_id' => $request->id,
                        'requester_name' => $request->user->name,
                        'destination' => $request->destination,
                        'date_of_travel' => $request->date_of_travel->format('Y-m-d'),
                        'vehicle' => $request->vehicle->description ?? 'N/A',
                        'driver' => $request->driver->name ?? 'N/A',
                    ],
                    'action_url' => route('tickets.pending-requests'),
                    'read' => false,
                ]);
            }

            Log::info('Ticket admins notified for trip ticket preparation', [
                'request_id' => $request->id,
                'notified_count' => $ticketAdmins->count()
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to notify ticket admin', [
                'request_id' => $request->id,
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * 5. TICKET ADMIN GENERATES TRIP TICKET
     * Notify: Assignment Admin
     */
    public function notifyTicketGenerated(VehicleRequest $vehicleRequest)
    {
        try {
            $assignmentAdmin = User::where('role', 'assignment_admin')->get();
            
            foreach ($assignmentAdmin as $admin) {
                Notification::create([
                    'user_id' => $admin->id,
                    'type' => 'ticket_generated',
                    'title' => 'Trip Ticket Generated',
                    'message' => "Trip ticket #{$vehicleRequest->trip_ticket_number} has been generated for {$vehicleRequest->user->name}'s request to {$vehicleRequest->destination}.",
                    'data' => [
                        'request_id' => $vehicleRequest->id,
                        'trip_ticket_number' => $vehicleRequest->trip_ticket_number,
                        'requester_name' => $vehicleRequest->user->name,
                        'destination' => $vehicleRequest->destination,
                        'date_of_travel' => $vehicleRequest->date_of_travel->format('Y-m-d'),
                        'vehicle' => $vehicleRequest->vehicle->description ?? 'N/A',
                        'driver' => $vehicleRequest->driver->name ?? 'N/A',
                    ],
                    'action_url' => route('assignment.drivers-tickets'),
                    'read' => false,
                ]);
            }

            Log::info('Assignment admins notified of ticket generation', [
                'request_id' => $vehicleRequest->id,
                'notified_count' => $assignmentAdmin->count()
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to notify assignment admin of ticket generation', [
                'request_id' => $vehicleRequest->id,
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * UTILITY: Get unread notification count for a user
     */
    public function getUnreadCount($userId): int
    {
        return Notification::where('user_id', $userId)
            ->where('read', false)
            ->count();
    }

    /**
     * UTILITY: Mark all notifications as read for a user
     */
    public function markAllAsRead($userId)
    {
        Notification::where('user_id', $userId)
            ->where('read', false)
            ->update([
                'read' => true,
                'read_at' => now(),
            ]);
    }

    /**
     * UTILITY: Delete old read notifications (cleanup)
     */
    public function cleanupOldNotifications($daysOld = 30)
    {
        $deletedCount = Notification::where('read', true)
            ->where('read_at', '<', now()->subDays($daysOld))
            ->delete();

        Log::info("Cleaned up old notifications", [
            'deleted_count' => $deletedCount
        ]);

        return $deletedCount;
    }
}