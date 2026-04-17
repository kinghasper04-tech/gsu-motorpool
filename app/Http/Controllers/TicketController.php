<?php

namespace App\Http\Controllers;

use Inertia\Inertia;
use setasign\Fpdi\Fpdi;
use App\Services\NotificationService;
use App\Models\Request;
use Illuminate\Http\Request as HttpRequest;

class TicketController extends Controller
{
    /**
     * Auto-complete requests
     */
    private function autoCompleteRequests()
    {
        Request::where('status', Request::STATUS_APPROVED)
            ->where('end_datetime', '<', now())
            ->update(['status' => Request::STATUS_COMPLETED]);
    }

    protected $notificationService;

    public function __construct(NotificationService $notificationService)
    {
        $this->notificationService = $notificationService;
    }

    /**
     * Ticket Admin Dashboard
     */
    public function dashboard()
    {
        // Auto-complete requests
        $this->autoCompleteRequests();

        // Stats
        $pendingTickets = Request::where('status', Request::STATUS_APPROVED)
            ->whereNull('trip_ticket_number')
            ->count();

        $generatedToday = Request::where('status', Request::STATUS_APPROVED)
            ->whereNotNull('trip_ticket_number')
            ->whereDate('ticket_generated_at', today())
            ->count();

        $sentToday = Request::where('status', Request::STATUS_APPROVED)
            ->whereNotNull('trip_ticket_number')
            ->whereDate('ticket_sent_at', today())
            ->count();

        $totalTickets = Request::whereNotNull('trip_ticket_number')
            ->where('status', '!=', Request::STATUS_CANCELLED)
            ->count();

        // Pending queue (10 oldest approved requests without tickets - FIFO)
        $pendingQueue = Request::where('status', Request::STATUS_APPROVED)
            ->where('status', '!=', Request::STATUS_CANCELLED)
            ->whereNull('trip_ticket_number')
            ->with(['user', 'vehicle', 'driver'])
            ->orderBy('approved_at', 'asc')
            ->limit(10)
            ->get()
            ->map(function ($request) {
                return [
                    'id' => $request->id,
                    'requester' => $request->user->name,
                    'destination' => $request->destination,
                    'date_of_travel' => $request->date_of_travel->format('M d, Y'),
                    'time_of_travel' => $request->time_of_travel,
                    'vehicle' => $request->vehicle ? $request->vehicle->description . ' (' . $request->vehicle->plate_number . ')' : 'N/A',
                    'driver' => $request->driver ? $request->driver->name : 'N/A',
                    'approved_at' => $request->approved_at->format('M d, Y H:i'),
                    'days_waiting' => now()->diffInDays($request->approved_at),
                    'travel_date' => $request->date_of_travel,
                    'is_imminent' => $request->start_datetime->lte(now()->addDays(2)),
                ];
            });

        // Recent tickets (last 7 generated tickets)
        $recentTickets = Request::where('status', Request::STATUS_APPROVED)
            ->where('status', '!=', Request::STATUS_CANCELLED)
            ->whereNotNull('trip_ticket_number')
            ->with(['user', 'vehicle', 'driver'])
            ->orderBy('ticket_generated_at', 'desc')
            ->limit(7)
            ->get()
            ->map(function ($request) {
                return [
                    'id' => $request->id,
                    'trip_ticket_number' => $request->trip_ticket_number,
                    'requester' => $request->user->name,
                    'destination' => $request->destination,
                    'vehicle' => $request->vehicle ? $request->vehicle->description : 'N/A',
                    'driver' => $request->driver ? $request->driver->name : 'N/A',
                    'generated_at' => $request->ticket_generated_at->format('M d, Y H:i'),
                    'sent' => $request->ticket_sent_at !== null,
                ];
            });

        // Upcoming trips with tickets (next 5 trips)
        $upcomingTrips = Request::where('status', Request::STATUS_APPROVED)
            ->where('status', '!=', Request::STATUS_CANCELLED)
            ->whereNotNull('trip_ticket_number')
            ->where('start_datetime', '>=', now())
            ->with(['user', 'vehicle', 'driver'])
            ->orderBy('start_datetime', 'asc')
            ->limit(5)
            ->get()
            ->map(function ($request) {
                return [
                    'id' => $request->id,
                    'trip_ticket_number' => $request->trip_ticket_number,
                    'requester' => $request->user->name,
                    'destination' => $request->destination,
                    'start_datetime' => $request->start_datetime->format('M d, Y H:i'),
                    'vehicle' => $request->vehicle ? $request->vehicle->description : 'N/A',
                    'driver' => $request->driver ? $request->driver->name : 'N/A',
                    'days_until' => now()->diffInDays($request->start_datetime, false),
                ];
            });

        return Inertia::render('Dashboard/TicketAdminDashboard', [
            'data' => [
                'pendingTickets' => $pendingTickets,
                'generatedToday' => $generatedToday,
                'sentToday' => $sentToday,
                'totalTickets' => $totalTickets,
                'pendingQueue' => $pendingQueue,
                'recentTickets' => $recentTickets,
                'upcomingTrips' => $upcomingTrips,
            ],
        ]);
    }

    /**
     * Show pending requests page with tabs and create trip ticket capability
     */
    public function pendingRequests()
    {
        // Requests that are approved but don't have trip ticket number yet
        $pendingRequests = Request::with(['driver', 'vehicle', 'user'])
            ->where('status', Request::STATUS_APPROVED)
            ->whereNull('trip_ticket_number')
            ->orderBy('created_at', 'desc')
            ->get();

        // All requests that have trip ticket numbers (for "List of All Tickets" tab)
        $allTickets = Request::with(['driver', 'vehicle', 'user'])
            ->where('status', Request::STATUS_APPROVED)
            ->whereNotNull('trip_ticket_number')
            ->orderBy('trip_ticket_number', 'asc')
            ->get();

        $completedTickets = Request::with(['driver', 'vehicle', 'user'])
            ->where('status', Request::STATUS_COMPLETED)
            ->whereNotNull('trip_ticket_number')
            ->orderBy('trip_ticket_number', 'asc')
            ->get();

        $cancelledRequests = Request::with(['driver', 'vehicle', 'user'])
            ->where('status', Request::STATUS_CANCELLED)
            ->whereNotNull('trip_ticket_number')
            ->orderBy('cancelled_at', 'desc')
            ->get();

        // Get preview request from session if exists
        $previewRequest = session('preview_request');
        
        // Get created trip ticket from session if exists
        $createdTripTicket = session('created_trip_ticket');
        
        // Clear the sessions after retrieving
        if ($previewRequest) {
            session()->forget('preview_request');
        }
        if ($createdTripTicket) {
            session()->forget('created_trip_ticket');
        }

        return inertia('Tickets/PendingRequests', [
            'pendingRequests' => $pendingRequests,
            'allTickets' => $allTickets,
            'completedTickets' => $completedTickets,
            'previewRequest' => $previewRequest,
            'createdTripTicket' => $createdTripTicket,
            'cancelledRequests' => $cancelledRequests,
        ]);
            }

    /**
     * Check availability of drivers and vehicles for new trip ticket creation
     */
    public function checkAvailabilityForNewTicket(HttpRequest $request)
    {
        try {
            $validated = $request->validate([
                'date_of_travel' => 'required|date',
                'time_of_travel' => 'required|date_format:H:i',
                'days_of_travel' => 'required|numeric|min:0.5',
                'half_day_period' => 'nullable|in:morning,afternoon,full'
            ]);

            // Validate half_day_period requirement
            $hasHalfDay = fmod((float)$validated['days_of_travel'], 1) !== 0.0;
            if ($hasHalfDay && empty($validated['half_day_period'])) {
                return response()->json([
                    'error' => 'Please select morning or afternoon for half-day requests.'
                ], 422);
            }

            // Calculate start and end datetime
            list($startDatetime, $endDatetime) = $this->calculateDateTimeRange(
                $validated['date_of_travel'],
                $validated['time_of_travel'],
                $validated['days_of_travel'],
                $validated['half_day_period'] ?? 'full'
            );

            // Get available vehicles
            $availableVehicles = \App\Models\Vehicle::where('status', \App\Models\Vehicle::STATUS_AVAILABLE)
                ->orderBy('plate_number')
                ->get()
                ->filter(function ($vehicle) use ($startDatetime, $endDatetime) {
                    return $vehicle->isAvailableForPeriod($startDatetime, $endDatetime);
                })
                ->values();

            // Get available drivers
            $availableDrivers = \App\Models\Driver::where('available', true)
                ->orderBy('name')
                ->get()
                ->filter(function ($driver) use ($startDatetime, $endDatetime) {
                    return $driver->isAvailableForPeriod($startDatetime, $endDatetime);
                })
                ->values();

            return response()->json([
                'success' => true,
                'availableVehicles' => $availableVehicles,
                'availableDrivers' => $availableDrivers,
                'startDatetime' => $startDatetime,
                'endDatetime' => $endDatetime
            ]);

        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'error' => 'Validation failed',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            \Log::error('Availability check error', [
                'message' => $e->getMessage(),
                'input' => $request->all()
            ]);

            return response()->json([
                'error' => 'Failed to check availability. Please try again.'
            ], 500);
        }
    }

    /**
     * Preview new trip ticket creation - NOW SAVES TO DATABASE
     */
    public function previewCreateTripTicket(HttpRequest $request)
    {
        $validated = $request->validate([
            'trip_ticket_number' => [
                'required',
                'string',
                'regex:/^\d{4}-\d{2}-(0[1-9]|[1-9]\d|[1-9]\d{2})$/',
                \Illuminate\Validation\Rule::unique('requests', 'trip_ticket_number')
            ],
            'driver_id' => 'required|exists:drivers,id',
            'vehicle_id' => 'required|exists:vehicles,id',
            'destination' => 'required|string|max:500',
            'purpose' => 'required|string|max:1000',
            'authorized_passengers' => 'nullable|string|max:500',
            'date_of_travel' => 'required|date',
            'time_of_travel' => 'required|date_format:H:i',
            'days_of_travel' => 'required|numeric|min:0.5',
            'half_day_period' => 'nullable|in:morning,afternoon,full'
        ], [
            'trip_ticket_number.unique' => 'This trip ticket number is already in use.',
            'trip_ticket_number.regex' => 'Trip ticket number must be in YYYY-MM-XX (01-99) or YYYY-MM-XXX (100-999) format.',
        ]);

        try {
            // Validate half_day_period requirement
            $hasHalfDay = fmod((float)$validated['days_of_travel'], 1) !== 0.0;
            if ($hasHalfDay && empty($validated['half_day_period'])) {
                return redirect()->back()
                    ->withErrors(['half_day_period' => 'Please select morning or afternoon for half-day requests.']);
            }

            // Calculate start and end datetime
            list($startDatetime, $endDatetime) = $this->calculateDateTimeRange(
                $validated['date_of_travel'],
                $validated['time_of_travel'],
                $validated['days_of_travel'],
                $validated['half_day_period'] ?? 'full'
            );

            // Check vehicle availability
            $vehicle = \App\Models\Vehicle::findOrFail($validated['vehicle_id']);
            if (!$vehicle->isAvailableForPeriod($startDatetime, $endDatetime)) {
                return redirect()->back()
                    ->withErrors(['vehicle_id' => 'This vehicle is not available for the selected time period.']);
            }

            // Check driver availability
            $driver = \App\Models\Driver::findOrFail($validated['driver_id']);
            if (!$driver->isAvailableForPeriod($startDatetime, $endDatetime)) {
                return redirect()->back()
                    ->withErrors(['driver_id' => 'This driver is not available for the selected time period.']);
            }

            \DB::beginTransaction();

            // CREATE REQUEST RECORD IN DATABASE
            $vehicleRequest = Request::create([
                'user_id' => auth()->id(),
                'trip_ticket_number' => $validated['trip_ticket_number'],
                'driver_id' => $validated['driver_id'],
                'vehicle_id' => $validated['vehicle_id'],
                'destination' => $validated['destination'],
                'purpose' => $validated['purpose'],
                'authorized_passengers' => $validated['authorized_passengers'] ?? null,
                'date_of_travel' => $validated['date_of_travel'],
                'time_of_travel' => $validated['time_of_travel'],
                'days_of_travel' => $validated['days_of_travel'],
                'half_day_period' => $validated['half_day_period'] ?? 'full',
                'start_datetime' => $startDatetime,
                'end_datetime' => $endDatetime,
                'status' => Request::STATUS_APPROVED,
                'approved_at' => now(),
                'approved_by' => auth()->id(),
                // NOT setting ticket_generated_at or ticket_sent_at yet - will be set on confirm
            ]);

            // CREATE ASSIGNMENT RECORD
            \App\Models\Assignment::create([
                'request_id' => $vehicleRequest->id,
                'vehicle_id' => $validated['vehicle_id'],
                'driver_id' => $validated['driver_id'],
                'assigned_start' => $startDatetime,
                'assigned_end' => $endDatetime,
            ]);

            \DB::commit();

            // Load relationships for the preview
            $vehicleRequest->load(['driver', 'vehicle', 'user']);

            // Store the created request data in session for preview modal
            session(['preview_request' => [
                'id' => $vehicleRequest->id, // Real database ID now!
                'trip_ticket_number' => $vehicleRequest->trip_ticket_number,
                'driver_id' => $vehicleRequest->driver_id,
                'vehicle_id' => $vehicleRequest->vehicle_id,
                'destination' => $vehicleRequest->destination,
                'purpose' => $vehicleRequest->purpose,
                'authorized_passengers' => $vehicleRequest->authorized_passengers ?? '',
                'date_of_travel' => $vehicleRequest->date_of_travel->format('Y-m-d'),
                'time_of_travel' => $vehicleRequest->time_of_travel,
                'days_of_travel' => $vehicleRequest->days_of_travel,
                'half_day_period' => $vehicleRequest->half_day_period,
                'start_datetime' => $vehicleRequest->start_datetime->toISOString(),
                'end_datetime' => $vehicleRequest->end_datetime->toISOString(),
                'status' => $vehicleRequest->status,
                'driver' => [
                    'id' => $driver->id,
                    'name' => $driver->name,
                ],
                'vehicle' => [
                    'id' => $vehicle->id,
                    'description' => $vehicle->description,
                    'model' => $vehicle->model,
                    'plate_number' => $vehicle->plate_number,
                ],
                'user' => [
                    'id' => auth()->id(),
                    'name' => auth()->user()->name,
                ],
                'is_new_ticket' => true
            ]]);

            return back();

        } catch (\Exception $e) {
            \DB::rollBack();
            \Log::error('Trip ticket preview error', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return redirect()->back()
                ->with('error', 'Failed to preview trip ticket: ' . $e->getMessage());
        }
    }

    /**
     * Cancel/Delete the preview trip ticket (when user clicks "Back to Edit")
     */
    public function cancelPreviewTripTicket(HttpRequest $request)
    {
        try {
            $validated = $request->validate([
                'request_id' => 'required|exists:requests,id'
            ]);

            $vehicleRequest = Request::findOrFail($validated['request_id']);

            // Verify it belongs to current user
            if ($vehicleRequest->user_id !== auth()->id()) {
                return response()->json([
                    'error' => 'Unauthorized'
                ], 403);
            }

            \DB::beginTransaction();

            // Delete the request (cascade will delete assignment)
            $vehicleRequest->delete();

            \DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Preview cancelled successfully'
            ]);

        } catch (\Exception $e) {
            \DB::rollBack();
            \Log::error('Cancel preview error', [
                'message' => $e->getMessage(),
                'request_id' => $request->input('request_id')
            ]);

            return response()->json([
                'error' => 'Failed to cancel preview: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Confirm and finalize the trip ticket (send notifications)
     */
    public function confirmCreateTripTicket(HttpRequest $request)
    {
        try {
            $validated = $request->validate([
                'request_id' => 'required|exists:requests,id'
            ]);

            $vehicleRequest = Request::with(['driver', 'vehicle', 'user'])
                ->findOrFail($validated['request_id']);

            // Verify it belongs to current user
            if ($vehicleRequest->user_id !== auth()->id()) {
                return redirect()->route('tickets.pending-requests')
                    ->with('error', 'Unauthorized action.');
            }

            \DB::beginTransaction();

            // Update timestamps to mark as finalized
            $vehicleRequest->update([
                'ticket_generated_at' => now(),
                'ticket_sent_at' => now(),
                'ticket_sent_to' => 'assignment_admin'
            ]);

            \DB::commit();

            // Refresh and store for viewing
            $vehicleRequest->refresh();
            $vehicleRequest->load(['driver', 'vehicle', 'user']);

            $createdTicketData = $vehicleRequest->toArray();
            $createdTicketData['id'] = (int) $vehicleRequest->id;
            
            session(['created_trip_ticket' => $createdTicketData]);

            return back()->with('success', 'Trip ticket created successfully!');;

        } catch (\Exception $e) {
            \DB::rollBack();
            \Log::error('Trip ticket confirmation error', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return redirect()->back()
                ->with('error', 'Failed to confirm trip ticket: ' . $e->getMessage());
        }
    }

    /**
     * Update trip ticket number
     */
    public function updateTripTicket(HttpRequest $request, \App\Models\Request $vehicleRequest)
    {
        try {
            $validated = $request->validate([
                'trip_ticket_number' => [
                    'required',
                    'string', 
                    'regex:/^\d{4}-\d{2}-(0[1-9]|[1-9]\d|[1-9]\d{2})$/',
                    \Illuminate\Validation\Rule::unique('requests', 'trip_ticket_number')
                        ->ignore($vehicleRequest->id)
                ]
            ], [
                'trip_ticket_number.unique' => 'This trip ticket number is already assigned to another request.',
                'trip_ticket_number.required' => 'Trip ticket number is required.',
                'trip_ticket_number.regex' => 'Trip ticket number must be in YYYY-MM-XX (01-99) or YYYY-MM-XXX (100-999) format.',
            ]);

            $vehicleRequest->update([
                'trip_ticket_number' => $validated['trip_ticket_number'],
                'ticket_generated_at' => now()
            ]);

            \DB::commit();

            return redirect()->back()->with('success', 'Trip ticket number updated successfully');

        } catch (\Illuminate\Validation\ValidationException $e) {
            return redirect()->back()
                ->withErrors($e->errors())
                ->withInput();
                
        } catch (\Exception $e) {
            \Log::error('Trip ticket update error', [
                'message' => $e->getMessage(),
                'request_id' => $vehicleRequest->id,
                'input' => $request->all()
            ]);

            return redirect()->back()
                ->with('error', 'Failed to update trip ticket number: ' . $e->getMessage());
        }
    }

    /**
     * Send trip ticket to assignment admin
     */
    public function sendToAssignmentAdmin(HttpRequest $request, \App\Models\Request $vehicleRequest)
    {
        try {
            // Verify ticket number exists
            if (!$vehicleRequest->trip_ticket_number) {
                return redirect()->back()
                    ->with('error', 'Cannot send ticket without a trip ticket number');
            }

            \DB::beginTransaction();

            // Mark as sent
            $vehicleRequest->update([
                'ticket_sent_at' => now(),
                'ticket_sent_to' => 'assignment_admin'
            ]);

            \DB::commit();

            $vehicleRequest->load(['driver', 'vehicle', 'user']);
            $this->notificationService->notifyTicketGenerated($vehicleRequest);

            return redirect()->back()->with('success', 'Trip ticket sent to Assignment Admin successfully');

        } catch (\Exception $e) {
            \Log::error('Failed to send trip ticket', [
                'message' => $e->getMessage(),
                'request_id' => $vehicleRequest->id
            ]);

            return redirect()->back()
                ->with('error', 'Failed to send trip ticket: ' . $e->getMessage());
        }
    }

    /**
     * Preview Ticket (inline in browser)
     */
    public function preview(\App\Models\Request $vehicleRequest)
    {
        $pdf = $this->generatePdf($vehicleRequest);

        return response($pdf->Output('S'))
            ->header('Content-Type', 'application/pdf')
            ->header('Content-Disposition', 'inline; filename="Driver_Ticket_'.$vehicleRequest->id.'.pdf"');
    }

    /**
     * Download Ticket
     */
    public function download(\App\Models\Request $vehicleRequest)
    {
        $pdf = $this->generatePdf($vehicleRequest);

        return response()->streamDownload(function () use ($pdf) {
            echo $pdf->Output('S');
        }, 'Driver_Ticket_'.$vehicleRequest->id.'.pdf');
    }

    /**
     * Calculate start and end datetime (same logic as RequestController)
     */
    private function calculateDateTimeRange($dateOfTravel, $timeOfTravel, $daysOfTravel, $halfDayPeriod)
    {
        $start = \Carbon\Carbon::parse("{$dateOfTravel} {$timeOfTravel}");
        $hasHalfDay = fmod((float)$daysOfTravel, 1) !== 0.0;

        if ($hasHalfDay) {
            $wholeDays = floor($daysOfTravel);
            $end = \Carbon\Carbon::parse($dateOfTravel);
            
            if ($wholeDays > 0) {
                $end->addDays($wholeDays);
            }
            
            if ($halfDayPeriod === 'morning') {
                $end->setTime(12, 0, 0);
            } else {
                $end->setTime(17, 0, 0);
            }
        } else {
            $end = \Carbon\Carbon::parse($dateOfTravel)
                        ->addDays($daysOfTravel - 1)
                        ->endOfDay();
        }

        return [$start, $end];
    }

    private function writeMultilineWithCustomStart($pdf, $text, $firstLineX, $startY, $firstLineWidth, $lineHeight, $continuationX, $continuationWidth = null)
    {
        // If continuation width not specified, use first line width
        if ($continuationWidth === null) {
            $continuationWidth = $firstLineWidth;
        }
        
        // Split text into words
        $words = explode(' ', $text);
        $currentLine = '';
        $currentY = $startY;
        $isFirstLine = true;
        
        foreach ($words as $word) {
            // Determine current max width
            $currentMaxWidth = $isFirstLine ? $firstLineWidth : $continuationWidth;
            
            // Test if adding this word exceeds the width
            $testLine = $currentLine . ($currentLine ? ' ' : '') . $word;
            $testWidth = $pdf->GetStringWidth($testLine);
            
            if ($testWidth > $currentMaxWidth && $currentLine !== '') {
                // Write the current line
                $currentX = $isFirstLine ? $firstLineX : $continuationX;
                $pdf->SetXY($currentX, $currentY);
                $pdf->Write(0, $currentLine);
                
                // Start new line
                $currentLine = $word;
                $currentY += $lineHeight;
                $isFirstLine = false;
            } else {
                $currentLine = $testLine;
            }
        }
        
        // Write the last line
        if ($currentLine !== '') {
            $currentX = $isFirstLine ? $firstLineX : $continuationX;
            $pdf->SetXY($currentX, $currentY);
            $pdf->Write(0, $currentLine);
        }
    }

    /**
     * Get filtered tickets for export
     */
    public function getExportData(HttpRequest $request)
    {
        try {
            $validated = $request->validate([
                'period' => 'required|in:this_month,this_year,all_time',
            ]);

            $query = Request::with(['driver', 'vehicle', 'user'])
                ->where('status', Request::STATUS_APPROVED)
                ->whereNotNull('trip_ticket_number')
                ->orderBy('trip_ticket_number', 'asc');

            // Apply period filter
            switch ($validated['period']) {
                case 'this_month':
                    $query->whereYear('date_of_travel', now()->year)
                          ->whereMonth('date_of_travel', now()->month);
                    break;
                case 'this_year':
                    $query->whereYear('date_of_travel', now()->year);
                    break;
                case 'all_time':
                    // No filter needed
                    break;
            }

            $tickets = $query->get()->map(function ($ticket) {
                return [
                    'id' => $ticket->id,
                    'trip_ticket_no' => $ticket->trip_ticket_number,
                    'driver' => $ticket->driver->name ?? 'N/A',
                    'vehicle' => ($ticket->vehicle->plate_number ?? 'N/A') . ' - ' . ($ticket->vehicle->description ?? ''),
                    'passengers' => $ticket->authorized_passengers ?? '',
                    'destination' => $ticket->destination,
                    'purpose' => $ticket->purpose,
                    'date_of_travel' => $ticket->date_of_travel->format('F d, Y'),
                    'remarks' => '',
                ];
            });

            return response()->json([
                'success' => true,
                'tickets' => $tickets,
                'count' => $tickets->count(),
                'period' => $validated['period'],
            ]);

        } catch (\Exception $e) {
            \Log::error('Export data fetch error', [
                'message' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => 'Failed to fetch export data'
            ], 500);
        }
    }

    /**
     * Export tickets as Excel with formatting
     */
    public function exportExcel(HttpRequest $request)
    {
        try {
            \Log::info('Excel export started', ['request_data' => $request->all()]);

            $validated = $request->validate([
                'tickets' => 'required|array',
                'tickets.*.trip_ticket_no' => 'required|string',
                'tickets.*.driver' => 'required|string',
                'tickets.*.vehicle' => 'required|string',
                'tickets.*.passengers' => 'nullable|string',
                'tickets.*.destination' => 'required|string',
                'tickets.*.purpose' => 'required|string',
                'tickets.*.date_of_travel' => 'required|string',
                'tickets.*.status' => 'nullable|string',
                'month' => 'nullable|integer|min:1|max:12',
                'year' => 'nullable|integer',
                'all_time' => 'required|boolean',
            ]);

            $tickets = $validated['tickets'];
            $month = $validated['month'];
            $year = $validated['year'];
            $allTime = $validated['all_time'];

            \Log::info('Excel export - tickets count: ' . count($tickets));

            // Check if PhpSpreadsheet is available
            if (!class_exists('PhpOffice\PhpSpreadsheet\Spreadsheet')) {
                \Log::error('PhpSpreadsheet class not found');
                return response()->json([
                    'error' => 'PhpSpreadsheet library is not installed.'
                ], 500);
            }

            // Create new Spreadsheet
            $spreadsheet = new \PhpOffice\PhpSpreadsheet\Spreadsheet();
            $sheet = $spreadsheet->getActiveSheet();
            $sheet->setTitle('Trip Tickets');

            //Set column widths
            $sheet->getColumnDimension('A')->setWidth(18);
            $sheet->getColumnDimension('B')->setWidth(25);
            $sheet->getColumnDimension('C')->setWidth(30);
            $sheet->getColumnDimension('D')->setWidth(35);
            $sheet->getColumnDimension('E')->setWidth(35);
            $sheet->getColumnDimension('F')->setWidth(40);
            $sheet->getColumnDimension('G')->setWidth(20);
            $sheet->getColumnDimension('H')->setWidth(30);

            // Headers
            $headers = [
                'Trip Ticket No.',
                'Driver',
                'Vehicle',
                'Passengers',
                'Destination',
                'Purpose of Travel',
                'Date of Travel',
                'Remarks'
            ];

            // Write headers
            $sheet->fromArray($headers, null, 'A1');

            // Style headers
            $headerStyle = [
                'font' => [
                    'bold' => true,
                    'size' => 11,
                    'name' => 'Bookman Old Style',
                ],
                'alignment' => [
                    'horizontal' => \PhpOffice\PhpSpreadsheet\Style\Alignment::HORIZONTAL_CENTER,
                    'vertical' => \PhpOffice\PhpSpreadsheet\Style\Alignment::VERTICAL_CENTER,
                ],
                'fill' => [
                    'fillType' => \PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID,
                    'startColor' => ['rgb' => 'E6E6E6'],
                ],
                'borders' => [
                    'allBorders' => [
                        'borderStyle' => \PhpOffice\PhpSpreadsheet\Style\Border::BORDER_THIN,
                    ],
                ],
            ];
            $sheet->getStyle('A1:H1')->applyFromArray($headerStyle);
            $sheet->getRowDimension(1)->setRowHeight(25);

            // Write data
            $row = 2;
            foreach ($tickets as $ticket) {
                $isCancelled = ($ticket['status'] ?? '') === 'cancelled';

                $sheet->setCellValue('A' . $row, $ticket['trip_ticket_no']);
                $sheet->setCellValue('B' . $row, $ticket['driver']);
                $sheet->setCellValue('C' . $row, $ticket['vehicle']);
                $sheet->setCellValue('D' . $row, $ticket['passengers'] ?? '');
                $sheet->setCellValue('E' . $row, $ticket['destination']);
                $sheet->setCellValue('F' . $row, $ticket['purpose']);
                $sheet->setCellValue('G' . $row, $ticket['date_of_travel']);
                $sheet->setCellValue('H' . $row, $isCancelled ? 'CANCELLED' : '');

                // Style data cells
                $dataStyle = [
                    'font' => [
                        'size' => 10,
                        'name' => 'Bookman Old Style',
                    ],
                    'alignment' => [
                        'horizontal' => \PhpOffice\PhpSpreadsheet\Style\Alignment::HORIZONTAL_LEFT,
                        'vertical' => \PhpOffice\PhpSpreadsheet\Style\Alignment::VERTICAL_TOP,
                        'wrapText' => true,
                    ],
                    'borders' => [
                        'allBorders' => [
                            'borderStyle' => \PhpOffice\PhpSpreadsheet\Style\Border::BORDER_THIN,
                        ],
                    ],
                ];
                $sheet->getStyle('A' . $row . ':H' . $row)->applyFromArray($dataStyle);

                // Apply red font to remarks cell only if cancelled
                if ($isCancelled) {
                    $sheet->getStyle('H' . $row)->applyFromArray([
                        'font' => [
                            'size' => 10,
                            'name' => 'Bookman Old Style',
                            'bold' => true,
                            'color' => ['rgb' => 'DC2626'],
                        ],
                    ]);
                }

                $sheet->getRowDimension($row)->setRowHeight(-1);

                $row++;
            }

            \Log::info('Excel data written, creating file...');

            // Generate filename based on filter
            $filename = 'trip_tickets_';
            if ($allTime) {
                $filename .= 'all_time';
            } else {
                $monthName = \Carbon\Carbon::create($year, $month, 1)->format('F');
                $filename .= "{$monthName}_{$year}";
            }
            $filename .= '.xlsx';

            // Create writer and save to temporary file
            $writer = new \PhpOffice\PhpSpreadsheet\Writer\Xlsx($spreadsheet);
            
            $tempFile = tempnam(sys_get_temp_dir(), 'excel_');
            \Log::info('Temp file created: ' . $tempFile);
            
            $writer->save($tempFile);
            \Log::info('Excel file saved: ' . $filename);

            return response()->download($tempFile, $filename, [
                'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            ])->deleteFileAfterSend(true);

        } catch (\Illuminate\Validation\ValidationException $e) {
            \Log::error('Excel validation error', ['errors' => $e->errors()]);
            return response()->json([
                'error' => 'Validation failed',
                'details' => $e->errors()
            ], 422);
            
        } catch (\Exception $e) {
            \Log::error('Excel export error', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'line' => $e->getLine(),
                'file' => $e->getFile()
            ]);

            return response()->json([
                'error' => 'Failed to export Excel: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Helper to build the PDF using template
     */
    private function generatePdf(Request $request): Fpdi
    {
        $pdf = new Fpdi();

        // Load Driver's Ticket template
        $pdf->setSourceFile(storage_path('app/templates/F3_Drivers-Ticket_rev3.pdf'));
        $tpl = $pdf->importPage(1);
        $size = $pdf->getTemplateSize($tpl);

        $pdf->AddPage($size['orientation'], [$size['width'], $size['height']]);
        $pdf->useTemplate($tpl, 0, 0, $size['width'], $size['height']);

        // font
        $pdf->AddFont('BookOS', '', 'BOOKOS.php');
        $pdf->AddFont('BookOS', 'B', 'BOOKOSB.php');
        $pdf->AddFont('BookOS', 'I', 'BOOKOSI.php');
        $pdf->SetFont('BookOS', '', 10);

        // Trip Ticket Number
        $pdf->SetXY(147, 44);
        $pdf->Write(0, $request->trip_ticket_number);
        // Driver
        $pdf->SetXY(112, 62);
        $pdf->Write(0, $request->driver->name);
        // Vehicle
        $pdf->SetXY(112, 67);
        $pdf->Write(0, $request->vehicle->description . ' - ' . $request->vehicle->plate_number);
        // Authorized Passengers
        $this->writeMultilineWithCustomStart($pdf, $request->authorized_passengers, 112, 72, 83, 5, 41, 166);
        // Destination
        $this->writeMultilineWithCustomStart($pdf, $request->destination, 112, 87, 83, 5, 41, 166);
        // Purpose
        $this->writeMultilineWithCustomStart($pdf, $request->purpose, 57, 97, 150, 4.5, 41, 166);
        // Date of Travel
        $pdf->SetXY(63, 106);
        $pdf->Write(0, $request->date_of_travel->format('F d, Y'));
        // Time of Travel
        $pdf->SetXY(147, 106);
        $timeObj = \Carbon\Carbon::parse($request->time_of_travel);
        $displayTime = $timeObj->format('h:i');
        $pdf->Write(0, $displayTime);

        // checkmark for AM or PM
        $pdf->SetFont('ZapfDingbats'); 
        $isAM = $timeObj->format('A') === 'AM';
        
        if ($isAM) {
            $pdf->SetXY(175, 106); 
            $pdf->Write(0, '4'); 
        } else {
            $pdf->SetXY(186.5, 106); 
            $pdf->Write(0, '4'); 
        }

        // Approval Admin Signature
        $pdf->SetFont('BookOS', 'I', 11);
        $pdf->SetXY(147, 112);
        $pdf->Write(0, 'Sgd.');

        return $pdf;
    }
}