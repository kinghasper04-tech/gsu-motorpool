<?php

namespace App\Http\Controllers\Admin;

use Inertia\Inertia;
use App\Models\Driver;
use App\Models\Vehicle;
use App\Models\Assignment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use App\Services\NotificationService;
use App\Models\Request as VehicleRequest;
use setasign\Fpdi\Fpdi;
use Carbon\Carbon;

class AssignmentController extends Controller
{
    /**
     * ASSIGNMENT ADMIN DASHBOARD
     */
    public function dashboard()
    {
        // Auto-complete requests
        $this->autoCompleteRequests();

        // Stats
        $pendingAssignments = VehicleRequest::where('status', VehicleRequest::STATUS_PENDING)
            ->count();

        $assignedRequests = VehicleRequest::where('status', VehicleRequest::STATUS_ASSIGNED)
            ->count();

        $totalVehicles = Vehicle::count();
        $totalDrivers = Driver::count();

        // Available resources today
        $today = today();
        $activeRequestIds = VehicleRequest::whereIn('status', [
                VehicleRequest::STATUS_ASSIGNED,
                VehicleRequest::STATUS_APPROVED
            ])
            ->whereDate('start_datetime', '<=', $today)
            ->whereDate('end_datetime', '>=', $today)
            ->pluck('id');

        $busyVehicleIds = VehicleRequest::whereIn('id', $activeRequestIds)
            ->whereNotNull('vehicle_id')
            ->pluck('vehicle_id');

        $busyDriverIds = VehicleRequest::whereIn('id', $activeRequestIds)
            ->whereNotNull('driver_id')
            ->pluck('driver_id');

        $availableVehicles = Vehicle::whereNotIn('id', $busyVehicleIds)->count();
        $availableDrivers = Driver::whereNotIn('id', $busyDriverIds)->count();

        // Active today
        $activeToday = VehicleRequest::whereIn('status', [
                VehicleRequest::STATUS_ASSIGNED,
                VehicleRequest::STATUS_APPROVED
            ])
            ->whereDate('start_datetime', '<=', $today)
            ->whereDate('end_datetime', '>=', $today)
            ->count();

        // Pending queue (10 oldest pending requests - FIFO)
        $pendingQueue = VehicleRequest::where('status', VehicleRequest::STATUS_PENDING)
            ->with(['user'])
            ->orderBy('created_at', 'asc')
            ->limit(10)
            ->get()
            ->map(function ($request) {
                return [
                    'id' => $request->id,
                    'requester' => $request->user->name,
                    'destination' => $request->destination,
                    'date_of_travel' => $request->date_of_travel->format('M d, Y'),
                    'time_of_travel' => $request->time_of_travel,
                    'days_of_travel' => $request->days_of_travel,
                    'formatted_duration' => $request->getFormattedDuration(),
                    'created_at' => $request->created_at->format('M d, Y H:i'),
                    'days_waiting' => now()->diffInDays($request->created_at),
                ];
            });

        // Conflicts detection
        $conflicts = $this->detectConflicts();

        // Assigned today
        $assignedToday = VehicleRequest::where('status', VehicleRequest::STATUS_ASSIGNED)
            ->whereDate('created_at', today())
            ->with(['user', 'vehicle', 'driver'])
            ->orderBy('created_at', 'desc')
            ->limit(5)
            ->get()
            ->map(function ($request) {
                return [
                    'id' => $request->id,
                    'requester' => $request->user->name,
                    'destination' => $request->destination,
                    'vehicle' => $request->vehicle ? $request->vehicle->description : 'N/A',
                    'driver' => $request->driver ? $request->driver->name : 'N/A',
                    'assigned_at' => $request->updated_at->format('H:i'),
                ];
            });

        return Inertia::render('Dashboard/AssignmentAdminDashboard', [
            'data' => [
                'pendingAssignments' => $pendingAssignments,
                'assignedRequests' => $assignedRequests,
                'totalVehicles' => $totalVehicles,
                'totalDrivers' => $totalDrivers,
                'availableVehicles' => $availableVehicles,
                'availableDrivers' => $availableDrivers,
                'activeToday' => $activeToday,
                'pendingQueue' => $pendingQueue,
                'conflicts' => $conflicts,
                'assignedToday' => $assignedToday,
            ],
        ]);
    }

    /**
     * Auto-complete requests
     */
    private function autoCompleteRequests()
    {
        VehicleRequest::where('status', VehicleRequest::STATUS_APPROVED)
            ->where('end_datetime', '<', now())
            ->update(['status' => VehicleRequest::STATUS_COMPLETED]);
    }

    /**
     * Detect scheduling conflicts
     */
    private function detectConflicts()
    {
        $conflicts = [];
        
        $futureRequests = VehicleRequest::whereIn('status', [
                VehicleRequest::STATUS_ASSIGNED,
                VehicleRequest::STATUS_APPROVED
            ])
            ->where('start_datetime', '>=', now())
            ->with(['user', 'vehicle', 'driver'])
            ->orderBy('start_datetime', 'asc')
            ->get();

        foreach ($futureRequests as $request) {
            $conflictingRequests = VehicleRequest::where('id', '!=', $request->id)
                ->whereIn('status', [VehicleRequest::STATUS_ASSIGNED, VehicleRequest::STATUS_APPROVED])
                ->where(function($query) use ($request) {
                    $query->where('vehicle_id', $request->vehicle_id)
                          ->orWhere('driver_id', $request->driver_id);
                })
                ->where(function($query) use ($request) {
                    $query->whereBetween('start_datetime', [$request->start_datetime, $request->end_datetime])
                          ->orWhereBetween('end_datetime', [$request->start_datetime, $request->end_datetime])
                          ->orWhere(function($q) use ($request) {
                              $q->where('start_datetime', '<=', $request->start_datetime)
                                ->where('end_datetime', '>=', $request->end_datetime);
                          });
                })
                ->with(['user', 'vehicle', 'driver'])
                ->get();

            if ($conflictingRequests->count() > 0) {
                foreach ($conflictingRequests as $conflicting) {
                    $conflicts[] = [
                        'request_id' => $request->id,
                        'requester' => $request->user->name,
                        'conflicting_request_id' => $conflicting->id,
                        'conflicting_requester' => $conflicting->user->name,
                        'type' => $request->vehicle_id === $conflicting->vehicle_id ? 'vehicle' : 'driver',
                        'resource' => $request->vehicle_id === $conflicting->vehicle_id 
                            ? ($request->vehicle ? $request->vehicle->description : 'Unknown Vehicle')
                            : ($request->driver ? $request->driver->name : 'Unknown Driver'),
                        'datetime' => $request->start_datetime->format('M d, Y H:i'),
                    ];
                }
            }
        }

        return collect($conflicts)->take(10);
    }

    /**
     * Show pending requests that need assignment
     */
    public function index()
    {
        $pendingRequests = VehicleRequest::where('status', VehicleRequest::STATUS_PENDING)
            ->with(['user'])
            ->orderBy('created_at', 'asc')
            ->get();

        return Inertia::render('Assignment/Requests', [
            'pendingRequests' => $pendingRequests,
        ]);
    }

    /**
     * Show assignment form for a specific request
     */
    public function showAssignForm($id)
    {
        $request = VehicleRequest::with(['user'])->findOrFail($id);
        
        // Get available vehicles for this time period
        $availableVehicles = Vehicle::where('status', Vehicle::STATUS_AVAILABLE)
            ->get()
            ->filter(function($vehicle) use ($request) {
                return $vehicle->isAvailableForPeriod(
                    $request->start_datetime,
                    $request->end_datetime
                );
            })
            ->values();

        // Get available drivers for this time period
        $availableDrivers = Driver::where('available', true)
            ->get()
            ->filter(function($driver) use ($request) {
                return $driver->isAvailableForPeriod(
                    $request->start_datetime,
                    $request->end_datetime
                );
            })
            ->values();

        return Inertia::render('Assignment/AssignForm', [
            'request' => $request,
            'availableVehicles' => $availableVehicles,
            'availableDrivers' => $availableDrivers,
        ]);
    }

    /**
     * Preview Assignment PDF before confirming
     */
    public function previewAssignment(Request $request, $id)
    {
        $validated = $request->validate([
            'vehicle_id' => 'required|exists:vehicles,id',
            'driver_id' => 'required|exists:drivers,id',
        ]);

        $vehicleRequest = VehicleRequest::with(['user'])->findOrFail($id);
        $vehicle = Vehicle::findOrFail($validated['vehicle_id']);
        $driver = Driver::findOrFail($validated['driver_id']);

        // Generate PDF with temporary assignment data
        $pdf = $this->generateAssignmentPdf($vehicleRequest, $vehicle, $driver, Auth::user());

        return response($pdf->Output('S'))
            ->header('Content-Type', 'application/pdf')
            ->header('Content-Disposition', 'inline; filename="Assignment_Preview_'.$id.'.pdf"');
    }

    /**
     * Assign vehicle and driver to a request
     */
    public function assign(Request $request, $id)
    {
        $validated = $request->validate([
            'vehicle_id' => 'required|exists:vehicles,id',
            'driver_id' => 'required|exists:drivers,id',
        ]);

        try {
            DB::beginTransaction();

            $vehicleRequest = VehicleRequest::findOrFail($id);
            
            // Ensure request is still pending
            if ($vehicleRequest->status !== VehicleRequest::STATUS_PENDING) {
                return back()->withErrors(['error' => 'Request is no longer pending assignment.']);
            }

            $vehicle = Vehicle::findOrFail($validated['vehicle_id']);
            $driver = Driver::findOrFail($validated['driver_id']);

            // Double-check availability
            if (!$vehicle->isAvailableForPeriod($vehicleRequest->start_datetime, $vehicleRequest->end_datetime)) {
                return back()->withErrors(['vehicle_id' => 'Vehicle is not available for this time period.']);
            }

            if (!$driver->isAvailableForPeriod($vehicleRequest->start_datetime, $vehicleRequest->end_datetime)) {
                return back()->withErrors(['driver_id' => 'Driver is not available for this time period.']);
            }

            // Update request with assignment
            $vehicleRequest->update([
                'vehicle_id' => $validated['vehicle_id'],
                'driver_id' => $validated['driver_id'],
                'status' => VehicleRequest::STATUS_ASSIGNED,
                'assigned_by' => Auth::id(),
                'updated_at' => now(),
            ]);

            // Create assignment record
            Assignment::create([
                'request_id' => $vehicleRequest->id,
                'vehicle_id' => $validated['vehicle_id'],
                'driver_id' => $validated['driver_id'],
                'assigned_start' => $vehicleRequest->start_datetime,
                'assigned_end' => $vehicleRequest->end_datetime,
            ]);

            DB::commit();

            // Notify approval admin
            app(NotificationService::class)->notifyApprovalAdmin($vehicleRequest);

            return redirect()->route('assignment.requests.index')
                ->with('success', 'Vehicle and driver assigned successfully!');

        } catch (\Exception $e) {
            DB::rollBack();
            return back()->withErrors(['error' => 'Assignment failed: ' . $e->getMessage()]);
        }
    }

    /**
     * Forward request to approval admin for declining (when no resources available)
     */
    public function forwardDecline(Request $request, $id)
    {
        $validated = $request->validate([
            'decline_reason' => ['required', 'string', 'min:5', 'max:500'],
        ]);

        try {
            DB::beginTransaction();

            $vehicleRequest = VehicleRequest::findOrFail($id);
            
            Log::info('Forwarding request for decline by assignment admin', [
                'request_id' => $id,
                'current_status' => $vehicleRequest->status,
                'user_id' => Auth::id(),
                'reason' => $validated['decline_reason']
            ]);
            
            // Ensure request is in pending or assigned status (without actual vehicle/driver assignment)
            if (!in_array($vehicleRequest->status, [VehicleRequest::STATUS_PENDING, VehicleRequest::STATUS_ASSIGNED])) {
                Log::warning('Forward decline failed - invalid status', [
                    'request_id' => $id,
                    'current_status' => $vehicleRequest->status,
                    'expected_statuses' => [VehicleRequest::STATUS_PENDING, VehicleRequest::STATUS_ASSIGNED]
                ]);
                throw new \Exception('Only pending or assigned requests can be forwarded for decline. Current status: ' . $vehicleRequest->status);
            }

            // Check if already forwarded for decline
            if ($vehicleRequest->forwarded_for_decline) {
                throw new \Exception('This request has already been forwarded for decline.');
            }

            // If it's assigned with actual vehicle/driver, prevent forwarding
            if ($vehicleRequest->status === VehicleRequest::STATUS_ASSIGNED && 
                ($vehicleRequest->vehicle_id || $vehicleRequest->driver_id)) {
                throw new \Exception('Cannot forward a request that already has assigned resources. Please unassign first.');
            }

            // Update the request status to assigned so approval admin sees it
            // and add the decline reason prepared by assignment admin
            $vehicleRequest->update([
                'status' => VehicleRequest::STATUS_ASSIGNED,
                'assigned_by' => Auth::id(),
                'updated_at' => now(),
                'forwarded_for_decline' => true,
                'forwarded_decline_reason' => $validated['decline_reason'],
                'vehicle_id' => null,
                'driver_id' => null,
            ]);

            DB::commit();

            Log::info('Request forwarded for decline successfully', [
                'request_id' => $id,
                'user_id' => Auth::id()
            ]);

            // Notify approval admin about the forwarded decline
            app(NotificationService::class)->notifyApprovalAdminForDecline($vehicleRequest);

            return redirect()->route('assignment.requests.index')
                ->with('success', 'Request forwarded to approval admin for declining.');

        } catch (\Illuminate\Validation\ValidationException $e) {
            DB::rollBack();
            Log::error('Forward decline validation failed', [
                'request_id' => $id,
                'errors' => $e->errors()
            ]);
            return back()->withErrors($e->errors());
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Forward decline failed: ' . $e->getMessage(), [
                'request_id' => $id,
                'user_id' => Auth::id(),
                'trace' => $e->getTraceAsString()
            ]);
            return back()->withErrors(['error' => 'Forward decline failed: ' . $e->getMessage()]);
        }
    }

    /**
     * Unified request management dashboard
     */
    public function requestManagement()
    {
        $pendingRequests = VehicleRequest::where('status', VehicleRequest::STATUS_PENDING)
            ->with(['user'])
            ->orderBy('created_at', 'asc')
            ->get();

        $assignedRequests = VehicleRequest::where('status', VehicleRequest::STATUS_ASSIGNED)
            ->where('forwarded_for_decline', false)
            ->with(['user', 'vehicle', 'driver', 'assignment'])
            ->orderBy('start_datetime', 'asc')
            ->get();

        $approvedRequests = VehicleRequest::where('status', VehicleRequest::STATUS_APPROVED)
            ->with(['user', 'vehicle', 'driver', 'assignment'])
            ->orderBy('start_datetime', 'asc')
            ->get();

        $completedRequests = VehicleRequest::where('status', VehicleRequest::STATUS_COMPLETED)
            ->with(['user', 'vehicle', 'driver', 'assignment'])
            ->orderBy('end_datetime', 'desc')
            ->get();

        $forwardedRequests = VehicleRequest::where('status', VehicleRequest::STATUS_ASSIGNED)
            ->where('forwarded_for_decline', true)
            ->with(['user'])
            ->orderBy('updated_at', 'desc')
            ->get();

        $declinedRequests = VehicleRequest::where('status', VehicleRequest::STATUS_DECLINED)
            ->with(['user', 'vehicle', 'driver'])
            ->orderBy('declined_at', 'desc')
            ->get();
        
        $cancelledRequests = VehicleRequest::where('status', VehicleRequest::STATUS_CANCELLED)
            ->with(['user', 'vehicle', 'driver'])
            ->orderBy('cancelled_at', 'desc')
            ->get();

        return Inertia::render('Assignment/RequestManagement', [
            'pendingRequests' => $pendingRequests,
            'assignedRequests' => $assignedRequests,
            'approvedRequests' => $approvedRequests,
            'completedRequests' => $completedRequests,
            'forwardedRequests' => $forwardedRequests,
            'declinedRequests' => $declinedRequests,
            'cancelledRequests' => $cancelledRequests,
            'vehicles' => Vehicle::all(),
            'drivers' => Driver::all(),
        ]);
    }

    /**
     * Check real-time availability for AJAX requests
     */
    public function checkAvailability(Request $request)
    {
        $vehicleId = $request->query('vehicle_id');
        $driverId = $request->query('driver_id');
        $startDateTime = $request->query('start_datetime');
        $endDateTime = $request->query('end_datetime');
        $excludeRequestId = $request->query('exclude_request_id');

        // Convert UTC timestamps from frontend back to local time
        // Frontend sends UTC (e.g., "2026-02-01T05:00:00.000000Z")
        // We need local time to compare with database (e.g., "2026-02-01 13:00:00")
        if ($startDateTime) {
            $startDateTime = Carbon::parse($startDateTime)->setTimezone(config('app.timezone'))->format('Y-m-d H:i:s');
        }
        if ($endDateTime) {
            $endDateTime = Carbon::parse($endDateTime)->setTimezone(config('app.timezone'))->format('Y-m-d H:i:s');
        }

        $response = [
            'vehicle_available' => true,
            'driver_available' => true,
            'conflicts' => []
        ];

        if ($vehicleId && $startDateTime && $endDateTime) {
            $vehicle = Vehicle::find($vehicleId);
            if ($vehicle && !$vehicle->isAvailableForPeriod($startDateTime, $endDateTime, $excludeRequestId)) {
                $response['vehicle_available'] = false;
                $response['conflicts'][] = 'Vehicle is not available for this time period';
            }
        }

        if ($driverId && $startDateTime && $endDateTime) {
            $driver = Driver::find($driverId);
            if ($driver && !$driver->isAvailableForPeriod($startDateTime, $endDateTime, $excludeRequestId)) {
                $response['driver_available'] = false;
                $response['conflicts'][] = 'Driver is not available for this time period';
            }
        }

        return response()->json($response);
    }

    /**
     * Reassign vehicle/driver to an existing assignment
     */
    public function reassign(Request $request, $id)
    {
        $validated = $request->validate([
            'vehicle_id' => 'required|exists:vehicles,id',
            'driver_id' => 'required|exists:drivers,id',
        ]);

        try {
            DB::beginTransaction();

            $vehicleRequest = VehicleRequest::findOrFail($id);
            $assignment = $vehicleRequest->assignment;

            if (!$assignment) {
                return back()->withErrors(['error' => 'No assignment found for this request.']);
            }

            // Check availability for new resources
            $vehicle = Vehicle::findOrFail($validated['vehicle_id']);
            $driver = Driver::findOrFail($validated['driver_id']);

            if (!$vehicle->isAvailableForPeriod($vehicleRequest->start_datetime, $vehicleRequest->end_datetime, $vehicleRequest->id)) {
                return back()->withErrors(['vehicle_id' => 'Vehicle is not available for this time period.']);
            }

            if (!$driver->isAvailableForPeriod($vehicleRequest->start_datetime, $vehicleRequest->end_datetime, $vehicleRequest->id)) {
                return back()->withErrors(['driver_id' => 'Driver is not available for this time period.']);
            }

            // Update request and assignment
            $vehicleRequest->update([
                'vehicle_id' => $validated['vehicle_id'],
                'driver_id' => $validated['driver_id'],
            ]);

            $assignment->update([
                'vehicle_id' => $validated['vehicle_id'],
                'driver_id' => $validated['driver_id'],
            ]);

            DB::commit();

            return back()->with('success', 'Assignment updated successfully!');

        } catch (\Exception $e) {
            DB::rollBack();
            return back()->withErrors(['error' => 'Reassignment failed: ' . $e->getMessage()]);
        }
    }

    /**
     * Remove assignment from a request
     */
    public function unassign($id)
    {
        try {
            DB::beginTransaction();

            $vehicleRequest = VehicleRequest::findOrFail($id);
            
            // Only allow unassigning if status is assigned (not approved)
            if ($vehicleRequest->status !== VehicleRequest::STATUS_ASSIGNED) {
                return back()->withErrors(['error' => 'Cannot unassign a request that is already approved.']);
            }

            // Remove assignment
            if ($vehicleRequest->assignment) {
                $vehicleRequest->assignment->delete();
            }

            // Update request status back to pending and clear forwarded flags
            $vehicleRequest->update([
                'vehicle_id' => null,
                'driver_id' => null,
                'status' => VehicleRequest::STATUS_PENDING,
                'forwarded_for_decline' => false,
                'forwarded_decline_reason' => null,
            ]);

            DB::commit();

            return back()->with('success', 'Assignment removed successfully!');

        } catch (\Exception $e) {
            DB::rollBack();
            return back()->withErrors(['error' => 'Unassignment failed: ' . $e->getMessage()]);
        }
    }

    /**
     * Show all driver's tickets for assignment admin
     */
    public function driversTickets()
    {
        $tickets = \App\Models\Request::with(['driver', 'vehicle', 'user'])
            ->where('status', \App\Models\Request::STATUS_APPROVED)
            ->whereNotNull('trip_ticket_number')
            ->whereNotNull('ticket_sent_at')
            ->orderBy('ticket_sent_at', 'desc')
            ->get();

        return inertia('Assignment/DriversTickets', [
            'tickets' => $tickets
        ]);
    }

    /**
     * Generate Assignment Confirmation PDF
     */
    private function generateAssignmentPdf(VehicleRequest $request, Vehicle $vehicle, Driver $driver, $assignmentAdmin): Fpdi
    {
        $pdf = new Fpdi();

        $pdf->setSourceFile(storage_path('app/templates/F2_Request-for-Use-of-Vehicle_rev1.pdf'));
        $tpl = $pdf->importPage(1);
        $size = $pdf->getTemplateSize($tpl);

        $pdf->AddPage($size['orientation'], [$size['width'], $size['height']]);
        $pdf->useTemplate($tpl, 0, 0, $size['width'], $size['height']);

        $pdf->AddFont('BookOS', '', 'BOOKOS.php');
        $pdf->AddFont('BookOS', 'B', 'BOOKOSB.php');
        $pdf->AddFont('BookOS', 'I', 'BOOKOSI.php');
        $pdf->SetFont('BookOS', '', 11);

        // Requestor Information
        // Name
        $pdf->SetXY(83, 52);
        $pdf->Write(0, $request->user->name);

        // Department & Position
        $pdf->SetXY(70, 59);
        $pdf->Write(0, "{$request->user->department} - {$request->user->position}");

        // Travel Details
        // Request No.
        $pdf->SetXY(165, 52);
        $pdf->Write(0, $request->id);

        // Date of Travel
        $pdf->SetXY(55, 140);
        $pdf->Write(0, $request->date_of_travel->format('F d, Y'));

        // Days of Travel (with half-day period if applicable)
        $pdf->SetXY(58, 148);
        $pdf->Write(0, $request->getFormattedDuration());

        // Time of Travel
        $pdf->SetXY(169, 140.5);
        $timeObj = Carbon::parse($request->time_of_travel);
        $displayTime = $timeObj->format('h:i A');
        $pdf->Write(0, $displayTime);

        // Destination
        $pdf->SetFont('BookOS', '', 9.5);
        $pdf->SetXY(68, 67);
        $pdf->Write(0, $request->destination);

        // Purpose 
        $pdf->SetXY(49, 70.5);
        $pdf->MultiCell(149, 7, $request->purpose, 0, 'L');  
        
        // Authorized Passengers
        $pdf->SetXY(72, 100);
        $pdf->MultiCell(125, 7, $request->authorized_passengers, 0, 'L');

        // Date Requested
        $pdf->SetFont('BookOS', '', 9);
        $pdf->SetXY(171, 59); 
        $pdf->Write(0, $request->created_at->format('M. j, Y'));

        // Time Requested
        $pdf->SetXY(172, 66.5); 
        $pdf->Write(0, $request->created_at->format('h:i A'));

        // ASSIGNMENT DETAILS
        // Assigned Vehicle
        $pdf->SetFont('BookOS', '', 10);
        $pdf->SetXY(148, 191.5);
        $pdf->MultiCell(56, 4, $vehicle->description . ' - ' . $vehicle->plate_number, 0, 'L');

        // Assigned Driver
        $pdf->SetXY(39, 194);
        $pdf->Write(0, $driver->name . ' - ' . $driver->contact_number);

        // Requestor Signature
        $pdf->SetFont('BookOS', 'I', 11);
        $pdf->SetXY(105, 159);
        $pdf->Write(0, 'Sgd.');

        $pdf->SetFont('BookOS', 'B', 11);
        $pdf->SetXY(90, 164);
        $pdf->Write(0, strtoupper($request->user->name));

        // Assignment Admin Signature
        $pdf->SetFont('BookOS', 'I', 11);
        $pdf->SetXY(105, 203);
        $pdf->Write(0, 'Sgd.');

        return $pdf;
    }
}