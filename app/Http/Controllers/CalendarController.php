<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use App\Models\Request as VehicleRequest;
use Illuminate\Support\Facades\Auth;
use Carbon\Carbon;

class CalendarController extends Controller
{
    /**
     * Display calendar view for all roles
     */
    public function index(): Response
    {
        $user = Auth::user();
        $requests = $this->getRequestsForUser($user);

        return Inertia::render('Calendar/Index', [
            'requests' => $requests,
            'userRole' => $user->role,
        ]);
    }

    /**
     * Get calendar events (AJAX endpoint)
     */
    public function getEvents(Request $request)
    {
        $start = $request->query('start');
        $end = $request->query('end');
        
        $user = Auth::user();
        $requests = $this->getRequestsForUser($user, $start, $end);

        // Format for FullCalendar
        $events = $requests->map(function ($req) {
            return [
                'id' => $req->id,
                'title' => $this->getEventTitle($req),
                'start' => $req->start_datetime->format('Y-m-d H:i:s'),
                'end' => $req->end_datetime->format('Y-m-d H:i:s'),
                'backgroundColor' => $this->getEventColor($req->status),
                'borderColor' => $this->getEventColor($req->status),
                'extendedProps' => [
                    'status' => $req->status,
                    'destination' => $req->destination,
                    'purpose' => $req->purpose,
                    'vehicle' => $req->vehicle ? $req->vehicle->description . ' - ' . $req->vehicle->plate_number : 'N/A',
                    'driver' => $req->driver ? $req->driver->name : 'N/A',
                    'requester' => $req->user->name,
                    'passengers' => $req->authorized_passengers,
                    'trip_ticket_number' => $req->trip_ticket_number,
                    'days_of_travel' => $req->days_of_travel,
                    'half_day_period' => $req->half_day_period,
                    'formatted_duration' => $req->getFormattedDuration(),
                ],
            ];
        });

        return response()->json($events);
    }

    /**
     * Get requests based on user role
     */
    private function getRequestsForUser($user, $start = null, $end = null)
{
    $query = VehicleRequest::with(['user', 'vehicle', 'driver', 'approver', 'decliner']);

    switch ($user->role) {
        case 'client':
            $query->where('user_id', $user->id)
                  ->whereIn('status', [
                      VehicleRequest::STATUS_APPROVED,
                      VehicleRequest::STATUS_COMPLETED,
                  ]);
            break;

        case 'assignment_admin':
        case 'approval_admin':
            $query->whereIn('status', [
                VehicleRequest::STATUS_ASSIGNED,
                VehicleRequest::STATUS_APPROVED,
                VehicleRequest::STATUS_COMPLETED,
            ]);
            break;

        case 'ticket_admin':
            $query->whereIn('status', [
                VehicleRequest::STATUS_APPROVED,
                VehicleRequest::STATUS_COMPLETED,
            ]);
            break;

        default:
            $query->whereRaw('1 = 0');
    }

    // Apply date range only to non-completed requests
    // Completed trips are always shown regardless of date
    if ($start && $end) {
        $query->where(function ($q) use ($start, $end) {
            $q->where('status', VehicleRequest::STATUS_COMPLETED) // always include completed
              ->orWhere(function ($q2) use ($start, $end) {
                  $q2->whereBetween('start_datetime', [$start, $end])
                     ->orWhereBetween('end_datetime', [$start, $end])
                     ->orWhere(function ($q3) use ($start, $end) {
                         $q3->where('start_datetime', '<=', $start)
                            ->where('end_datetime', '>=', $end);
                     });
              });
        });
    }

    return $query->orderBy('start_datetime', 'asc')->get();
}

    /**
     * Check if user can view specific request
     */
    private function canViewRequest($user, $request): bool
    {
        switch ($user->role) {
            case 'client':
                // Clients can only view their own approved or completed requests
                return $request->user_id === $user->id && 
                       in_array($request->status, [
                           VehicleRequest::STATUS_APPROVED,
                           VehicleRequest::STATUS_COMPLETED
                       ]);

            case 'assignment_admin':
            case 'approval_admin':
                // These admins can view assigned, approved and completed requests
                return in_array($request->status, [
                    VehicleRequest::STATUS_ASSIGNED,
                    VehicleRequest::STATUS_APPROVED,
                    VehicleRequest::STATUS_COMPLETED,
                ]);

            case 'ticket_admin':
                // Ticket admins can view approved and completed requests
                return in_array($request->status, [
                    VehicleRequest::STATUS_APPROVED,
                    VehicleRequest::STATUS_COMPLETED,
                ]);

            default:
                return false;
        }
    }

    /**
     * Get event title for calendar
     */
    private function getEventTitle($request): string
    {
        $user = Auth::user();

        switch ($user->role) {
            case 'client':
                return $request->destination;

            case 'assignment_admin':
            case 'approval_admin':
            case 'ticket_admin':
                return $request->user->name . ' - ' . $request->destination;

            default:
                return $request->destination;
        }
    }

    /**
     * Show details of a single request (AJAX endpoint)
     */
    public function show($id)
    {
        $user = Auth::user();

        // Fetch the request with relationships
        $request = VehicleRequest::with(['user', 'vehicle', 'driver', 'approver', 'decliner'])
            ->findOrFail($id);

        // Check if the user is allowed to view this request
        if (!$this->canViewRequest($user, $request)) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        // Return JSON details for the modal
        return response()->json([
            'id' => $request->id,
            'destination' => $request->destination,
            'purpose' => $request->purpose,
            'authorized_passengers' => $request->authorized_passengers,
            'date_of_travel' => $request->date_of_travel->format('Y-m-d'),
            'time_of_travel' => $request->time_of_travel,
            'days_of_travel' => $request->days_of_travel,
            'half_day_period' => $request->half_day_period,
            'formatted_duration' => $request->getFormattedDuration(),
            'start_datetime' => $request->start_datetime?->format('Y-m-d H:i:s'),
            'end_datetime' => $request->end_datetime?->format('Y-m-d H:i:s'),
            'status' => $request->status,
            'trip_ticket_number' => $request->trip_ticket_number,
            'vehicle' => $request->vehicle ? [
                'id' => $request->vehicle->id,
                'description' => $request->vehicle->description,
                'plate_number' => $request->vehicle->plate_number,
            ] : null,
            'driver' => $request->driver ? [
                'id' => $request->driver->id,
                'name' => $request->driver->name,
                'contact_number' => $request->driver->contact_number ?? null,
            ] : null,
            'user' => [
                'id' => $request->user->id,
                'name' => $request->user->name,
            ],
            'approved_by' => $request->approver?->name,
            'declined_by' => $request->decliner?->name,
            'decline_reason' => $request->decline_reason,
            'approved_at' => $request->approved_at?->format('Y-m-d H:i:s'),
            'declined_at' => $request->declined_at?->format('Y-m-d H:i:s'),
            'created_at' => $request->created_at?->format('Y-m-d H:i:s'),
        ]);
    }

    /**
     * Get event color based on status
     */
    private function getEventColor($status): string
    {
        switch ($status) {
            case VehicleRequest::STATUS_PENDING:
                return '#f59e0b'; // Amber
            case VehicleRequest::STATUS_ASSIGNED:
                return '#3b82f6'; // Blue
            case VehicleRequest::STATUS_APPROVED:
                return '#10b981'; // Green
            case VehicleRequest::STATUS_DECLINED:
                return '#ef4444'; // Red
            case VehicleRequest::STATUS_COMPLETED:
                return '#8b5cf6'; // Purple
            default:
                return '#6b7280'; // Gray
        }
    }
}