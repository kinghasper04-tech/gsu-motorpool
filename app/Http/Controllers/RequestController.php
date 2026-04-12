<?php

namespace App\Http\Controllers;

use Carbon\Carbon;
use Inertia\Inertia;
use Inertia\Response;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Services\NotificationService;
use Illuminate\Http\RedirectResponse;
use App\Models\Request as VehicleRequest;
use setasign\Fpdi\Fpdi;
use App\Models\User;

class RequestController extends Controller
{
    public function create()
    {
        return Inertia::render('Client/RequestForm');
    }

    /**
     * Preview Request Form PDF before submission
     */
    public function previewRequest(Request $request)
    {
        // Validate the data
        $validated = $request->validate([
            'destination' => 'required|string',
            'purpose' => 'required|string',
            'authorized_passengers' => 'required|string',
            'date_of_travel' => 'required|date',
            'days_of_travel' => 'required|numeric|min:0.5',
            'half_day_period' => 'nullable|in:morning,afternoon,full',
            'time_of_travel' => 'required|date_format:H:i',
        ]);

        // Validate half-day period requirement
        $this->validateHalfDayPeriod($validated['days_of_travel'], $validated['half_day_period'] ?? null);

        // Generate PDF with temporary data
        $pdf = $this->generateRequestPdf($validated, $request->user());

        return response($pdf->Output('S'))
            ->header('Content-Type', 'application/pdf')
            ->header('Content-Disposition', 'inline; filename="Request_Preview.pdf"');
    }

    /**
     * Generate and download PDF for approved/declined/completed request
     */
    public function downloadPdf($id)
    {
        $user = auth()->user();
        
        // Build query based on user role
        $query = VehicleRequest::with(['user', 'vehicle', 'driver']);
        
        if ($user->role === 'client') {
            // Clients can only view their own requests
            $query->where('user_id', $user->id);
        }
        // Admins can view any request (no additional where clause needed)
        
        $request = $query->findOrFail($id);

        // Only allow PDF download for approved, completed, or declined requests
        if (!in_array($request->status, [VehicleRequest::STATUS_APPROVED, VehicleRequest::STATUS_COMPLETED, VehicleRequest::STATUS_DECLINED])) {
            abort(403, 'PDF is only available for approved, completed, or declined requests.');
        }

        // Determine action for PDF generation
        $action = in_array($request->status, [VehicleRequest::STATUS_APPROVED, VehicleRequest::STATUS_COMPLETED]) ? 'approve' : 'decline';
        $declineReason = $request->decline_reason ?? '';

        // Get approval admin who processed the request
        $approvalAdmin = in_array($request->status, [VehicleRequest::STATUS_APPROVED, VehicleRequest::STATUS_COMPLETED])
            ? User::find($request->approved_by)
            : User::find($request->declined_by);

        // Generate PDF
        $pdf = $this->generateClientRequestPdf($request, $action, $declineReason, $approvalAdmin);

        $statusLabel = $request->status === VehicleRequest::STATUS_DECLINED ? 'Declined' : 'Approved';
        $filename = "{$statusLabel}_Request_{$request->id}.pdf";

        return response($pdf->Output('D', $filename))
            ->header('Content-Type', 'application/pdf');
    }

    public function previewPdf($id)
    {
        $user = auth()->user();
        
        // Build query based on user role
        $query = VehicleRequest::with(['user', 'vehicle', 'driver']);
        
        if ($user->role === 'client') {
            // Clients can only view their own requests
            $query->where('user_id', $user->id);
        }
        // Admins can view any request (no additional where clause needed)
        
        $request = $query->findOrFail($id);

        // Only allow PDF preview for approved, completed, or declined requests
        if (!in_array($request->status, [VehicleRequest::STATUS_APPROVED, VehicleRequest::STATUS_COMPLETED, VehicleRequest::STATUS_DECLINED])) {
            abort(403, 'PDF is only available for approved, completed, or declined requests.');
        }

        // Determine action for PDF generation
        $action = in_array($request->status, [VehicleRequest::STATUS_APPROVED, VehicleRequest::STATUS_COMPLETED]) ? 'approve' : 'decline';
        $declineReason = $request->decline_reason ?? '';

        // Get approval admin who processed the request
        $approvalAdmin = in_array($request->status, [VehicleRequest::STATUS_APPROVED, VehicleRequest::STATUS_COMPLETED])
            ? User::find($request->approved_by)
            : User::find($request->declined_by);

        // Generate PDF
        $pdf = $this->generateClientRequestPdf($request, $action, $declineReason, $approvalAdmin);

        return response($pdf->Output('I'))
            ->header('Content-Type', 'application/pdf')
            ->header('Content-Disposition', 'inline; filename="Request_' . $request->id . '.pdf"');
    }

        // ── PDF helpers ──────────────────────────────────────────────────────
 
    /**
     * Format date range for PDF display.
     *
     * Same day, no half day  → "April 4, 2026"
     * Same day, half day     → "April 4, 2026 (Morning)"
     * Same month range       → "April 4 – 6, 2026"
     * Same month, half day   → "April 4 – 6, 2026 (Morning)"
     * Cross-month range      → "April 30 – May 1, 2026"
     * Cross-month, half day  → "April 30 – May 1, 2026 (Morning)"
     * Cross-year range       → "December 31, 2025 – January 1, 2026"
     */
    private function formatDateRangeForPdf(Carbon $from, Carbon $to, ?string $halfDayPeriod): string
    {
        // Same day
        if ($from->isSameDay($to)) {
            return $from->format('F j, Y');
        }
 
        // Same month and year
        if ($from->month === $to->month && $from->year === $to->year) {
            return $from->format('F j') . ' - ' . $to->format('j, Y');
        }

        // Same year, different month
        if ($from->year === $to->year) {
            return $from->format('F j') . ' - ' . $to->format('F j, Y');
        }

        // Different year
        return $from->format('F j, Y') . ' - ' . $to->format('F j, Y');
    }
 
    /**
     * Derive the end calendar date from stored request data.
     * Mirrors calculateDateTimeRange() so it is always consistent.
     */
    private function deriveEndDate(Carbon $dateOfTravel, float $daysOfTravel, ?string $halfDayPeriod): Carbon
    {
        $hasHalfDay = fmod($daysOfTravel, 1) !== 0.0;
 
        if ($hasHalfDay) {
            $wholeDays = (int) floor($daysOfTravel);
            $end = $dateOfTravel->copy();
            if ($wholeDays > 0) {
                $end->addDays($wholeDays);
            }
            return $end;
        }
 
        return $dateOfTravel->copy()->addDays((int) $daysOfTravel - 1);
    }
    
    private function generateClientRequestPdf(VehicleRequest $request, string $action, string $declineReason, $approvalAdmin): Fpdi
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

        // Request No.
        $pdf->SetXY(165, 52);
        $pdf->Write(0, $request->id);

        // Date Requested
        $pdf->SetXY(171, 59);
        $pdf->Write(0, $request->created_at->format('M. j, Y'));

        // Time Requested
        $pdf->SetXY(172, 66.5);
        $pdf->Write(0, $request->created_at->format('h:i A'));

        // Requestor Name
        $pdf->SetXY(83, 52);
        $pdf->Write(0, $request->user->name);

        // Department & Position
        $pdf->SetXY(70, 59);
        $pdf->Write(0, "{$request->user->department} - {$request->user->position}");

        // Destination
        $pdf->SetFont('BookOS', '', 9.5);
        $pdf->SetXY(68, 67);
        $pdf->Write(0, $request->destination);

        // Purpose
        $pdf->SetFont('BookOS', '', 11);
        $pdf->SetXY(49, 70.5);
        $pdf->MultiCell(149, 7, $request->purpose, 0, 'L');

        // Authorized Passengers
        $pdf->SetXY(72, 100);
        $pdf->MultiCell(125, 7, $request->authorized_passengers, 0, 'L');

        // Date of Travel
        $endDate      = $this->deriveEndDate(
            $request->date_of_travel,
            (float) $request->days_of_travel,
            $request->half_day_period
        );
        $dateRangeStr = $this->formatDateRangeForPdf(
            $request->date_of_travel,
            $endDate,
            $request->half_day_period
        );
 
        $pdf->SetXY(55, 140);
        $pdf->Write(0, $dateRangeStr);

        // Days of Travel (with half-day period if applicable)
        $pdf->SetXY(58, 148);
        $pdf->Write(0, $request->getFormattedDuration());

        // Time of Travel
        $pdf->SetXY(169, 140.5);
        $timeObj = Carbon::parse($request->time_of_travel);
        $displayTime = $timeObj->format('h:i A');
        $pdf->Write(0, $displayTime);

        // Assigned Vehicle (if any)
        if ($request->vehicle) {
            $pdf->SetFont('BookOS', '', 10);
            $pdf->SetXY(148, 191.5);
            $pdf->MultiCell(56, 4, $request->vehicle->description, 0, 'L');
        } else {
            $pdf->SetFont('BookOS', '', 10);
            $pdf->SetXY(148, 194);
            $pdf->Write(0, 'Not Assigned');
        }

        if ($request->driver) {
            $pdf->SetXY(39, 194);
            $pdf->Write(0, $request->driver->name);
        } else {
            $pdf->SetXY(39, 194);
            $pdf->Write(0, 'Not Assigned');
        }

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

        // Approval/Decline Status
        $pdf->SetFont('ZapfDingbats');
        $pdf->SetFontSize(15);

        if ($action === 'approve') {
            $pdf->SetXY(25.5, 228);
            $pdf->Write(0, '4'); // Checkmark
        } elseif ($action === 'decline') {
            $pdf->SetXY(82.5, 228);
            $pdf->Write(0, '4'); // Checkmark

            // Decline Reason
            $pdf->SetFont('BookOS', '', 11);
            $pdf->SetXY(127, 228);
            $pdf->Write(0, $declineReason);
        }

        // Approval Admin Signature
        if ($approvalAdmin) {
            $pdf->SetFont('BookOS', 'I', 11);
            $pdf->SetXY(105, 242);
            $pdf->Write(0, 'Sgd.');
        }

        return $pdf;
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'destination' => 'required|string',
            'purpose' => 'required|string',
            'authorized_passengers' => 'required|string',
            'date_of_travel' => 'required|date',
            'days_of_travel' => 'required|numeric|min:0.5',
            'half_day_period' => 'nullable|in:morning,afternoon,full',
            'time_of_travel' => 'required|date_format:H:i',
        ]);

        // Validate half-day period requirement
        $this->validateHalfDayPeriod($validated['days_of_travel'], $validated['half_day_period'] ?? null);

        // Calculate start and end datetime
        list($start, $end) = $this->calculateDateTimeRange(
            $validated['date_of_travel'],
            $validated['time_of_travel'],
            $validated['days_of_travel'],
            $validated['half_day_period'] ?? 'full'
        );

        $vehicleRequest = $request->user()->vehicleRequests()->create([
            'destination' => $validated['destination'],
            'purpose' => $validated['purpose'],
            'authorized_passengers' => $validated['authorized_passengers'],
            'date_of_travel' => $validated['date_of_travel'],
            'days_of_travel' => $validated['days_of_travel'],
            'half_day_period' => $validated['half_day_period'] ?? 'full',
            'time_of_travel' => $validated['time_of_travel'],
            'start_datetime' => $start,
            'end_datetime' => $end,
            'status' => VehicleRequest::STATUS_PENDING,
        ]);

        // Notify assignment admin
        app(NotificationService::class)->notifyAssignmentAdmin($vehicleRequest);

        return redirect()->route('requests.index')->with('success', 'Vehicle request submitted successfully!');
    }

    /**
     * Unified my requests page
     */
    public function myRequests(): Response
    {
        $userId = Auth::id();

        // Auto-mark completed requests before fetching
        VehicleRequest::where('user_id', $userId)
            ->where('status', VehicleRequest::STATUS_APPROVED)
            ->where('end_datetime', '<', now())
            ->update(['status' => VehicleRequest::STATUS_COMPLETED]);

        $pendingRequests = VehicleRequest::where('user_id', $userId)
            ->where('status', VehicleRequest::STATUS_PENDING)
            ->orderBy('created_at', 'desc')
            ->get();

        $assignedRequests = VehicleRequest::where('user_id', $userId)
            ->where('status', VehicleRequest::STATUS_ASSIGNED)
            ->with(['vehicle', 'driver'])
            ->orderBy('updated_at', 'desc')
            ->get();

        $approvedRequests = VehicleRequest::where('user_id', $userId)
            ->where('status', VehicleRequest::STATUS_APPROVED)
            ->with(['vehicle', 'driver'])
            ->orderBy('approved_at', 'desc')
            ->get();

        $completedRequests = VehicleRequest::where('user_id', $userId)
            ->where('status', VehicleRequest::STATUS_COMPLETED)
            ->with(['vehicle', 'driver'])
            ->orderBy('end_datetime', 'desc')
            ->get();

        $declinedRequests = VehicleRequest::where('user_id', $userId)
            ->where('status', VehicleRequest::STATUS_DECLINED)
            ->orderBy('declined_at', 'desc')
            ->get();

        $cancelledRequests = VehicleRequest::where('user_id', $userId)
            ->where('status', VehicleRequest::STATUS_CANCELLED)
            ->orderBy('cancelled_at', 'desc')
            ->get();
        
        return Inertia::render('Client/MyRequests', [
            'pendingRequests' => $pendingRequests,
            'assignedRequests' => $assignedRequests,
            'approvedRequests' => $approvedRequests,
            'completedRequests' => $completedRequests,
            'declinedRequests' => $declinedRequests,
            'cancelledRequests' => $cancelledRequests,
        ]);
    }

    public function edit($id): Response
    {
        $request = VehicleRequest::where('user_id', auth()->id())->findOrFail($id);

        return Inertia::render('Client/EditRequest', [
            'request' => $request,
        ]);
    }

    public function update(Request $request, $id)
    {
        $requestData = $request->validate([
            'purpose' => 'required|string|max:255',
            'destination' => 'required|string|max:255',
            'authorized_passengers' => 'required|string|max:255',
            'date_of_travel' => 'required|date',
            'days_of_travel' => 'required|numeric|min:0.5',
            'half_day_period' => 'nullable|in:morning,afternoon,full',
            'time_of_travel' => 'required',
        ]);

        // Validate half-day period requirement
        $this->validateHalfDayPeriod($requestData['days_of_travel'], $requestData['half_day_period'] ?? null);

        // Normalize date and time
        $requestData['date_of_travel'] = Carbon::parse($requestData['date_of_travel'])->toDateString();
        $cleanTime = Carbon::parse($requestData['time_of_travel'])->format('H:i');
        $requestData['time_of_travel'] = $cleanTime;

        // Calculate start and end datetime
        list($start, $end) = $this->calculateDateTimeRange(
            $requestData['date_of_travel'],
            $cleanTime,
            $requestData['days_of_travel'],
            $requestData['half_day_period'] ?? 'full'
        );

        // Add computed times to update array
        $requestData['start_datetime'] = $start;
        $requestData['end_datetime'] = $end;
        $requestData['half_day_period'] = $requestData['half_day_period'] ?? 'full';

        // Update the request record
        $requestModel = VehicleRequest::where('user_id', auth()->id())->findOrFail($id);
        $requestModel->update($requestData);

        return redirect()->route('requests.index')
            ->with('success', 'Request updated successfully!');
    }

    public function destroy($id)
    {
        $requestModel = VehicleRequest::findOrFail($id);
        $requestModel->delete();
    
        return redirect()->route('requests.index')->with('success', 'Request deleted successfully.');
    }

    public function cancel($id)
    {
        $user = auth()->user();

        $vehicleRequest = VehicleRequest::where('user_id', $user->id)->findOrFail($id);

        $cancellableStatuses = [
            VehicleRequest::STATUS_ASSIGNED,
            VehicleRequest::STATUS_APPROVED,
        ];

        if (!in_array($vehicleRequest->status, $cancellableStatuses)) {
            return redirect()->route('requests.index')
                ->with('error', 'This request cannot be cancelled.');
        }

        // Fire notification before status changes so we can still read prior_status
        app(NotificationService::class)->notifyCancellation($vehicleRequest);

        $vehicleRequest->update([
            'status'       => VehicleRequest::STATUS_CANCELLED,
            'cancelled_at' => now(),
            'cancelled_by' => $user->id,
        ]);

        return redirect()->route('requests.index')
            ->with('success', 'Request cancelled successfully.');
    }
    
    public function show($id)
    {
        try {
            $vehicleRequest = VehicleRequest::with(['user', 'vehicle', 'driver'])
                ->findOrFail($id);

            // Ensure the authenticated user can view this request
            if (auth()->id() !== $vehicleRequest->user_id) {
                return response()->json(['error' => 'Unauthorized'], 403);
            }

            return response()->json($vehicleRequest);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json(['error' => 'Request not found'], 404);
        } catch (\Exception $e) {
            return response()->json(['error' => 'An unexpected error occurred'], 500);
        }
    }

    /**
     * Validate that half_day_period is provided when needed
     */
    private function validateHalfDayPeriod($daysOfTravel, $halfDayPeriod)
    {
        $hasHalfDay = fmod((float)$daysOfTravel, 1) !== 0.0;
        
        if ($hasHalfDay && empty($halfDayPeriod)) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'half_day_period' => 'Please select morning or afternoon for half-day requests.'
            ]);
        }
    }

    /**
     * Calculate start and end datetime based on days of travel and half-day period
     */
    private function calculateDateTimeRange($dateOfTravel, $timeOfTravel, $daysOfTravel, $halfDayPeriod)
    {
        $start = Carbon::parse("{$dateOfTravel} {$timeOfTravel}");
        $hasHalfDay = fmod((float)$daysOfTravel, 1) !== 0.0;

        if ($hasHalfDay) {
            // Get the whole days part
            $wholeDays = floor($daysOfTravel);
            
            // Start from the base date
            $end = Carbon::parse($dateOfTravel);
            
            // Add whole days if any
            if ($wholeDays > 0) {
                $end->addDays($wholeDays);
            }
            
            // Set end time based on half-day period
            if ($halfDayPeriod === 'morning') {
                $end->setTime(12, 0, 0); // 12:00 PM
            } else { // afternoon
                $end->setTime(17, 0, 0); // 5:00 PM
            }
        } else {
            // Full day(s) - use existing logic
            $end = Carbon::parse($dateOfTravel)
                        ->addDays($daysOfTravel - 1)
                        ->endOfDay(); // 23:59:59
        }

        return [$start, $end];
    }

    /**
     * Generate Request Form PDF
     */
    private function generateRequestPdf(array $data, $user): Fpdi
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
        $pdf->Write(0, $user->name);

        // Department and Position
        $pdf->SetXY(70, 59); 
        $pdf->Write(0, $user->department . ' - ' . $user->position);

        // Date Requested
        $pdf->SetXY(171, 59); 
        $pdf->Write(0, Carbon::now()->format('M. j, Y'));

        // Time Requested
        $pdf->SetXY(172, 66.5); 
        $pdf->Write(0, Carbon::now()->format('h:i A'));

        // Destination
        $pdf->SetFont('BookOS', '', 9.5);
        $pdf->SetXY(67, 67); 
        $pdf->Write(0, $data['destination']);

        // Purpose
        $pdf->SetXY(49, 70.5);
        $pdf->MultiCell(149, 7, $data['purpose'] ?? '', 0, 'L');

        // Authorized Passengers
        $pdf->SetXY(72, 100);
        $pdf->MultiCell(125, 7, $data['authorized_passengers'] ?? '', 0, 'L');

        // Date of Travel
        $fromDate     = Carbon::parse($data['date_of_travel']);
        $daysOfTravel = (float) ($data['days_of_travel'] ?? 1);
        $halfDay      = $data['half_day_period'] ?? 'full';
        $endDate      = $this->deriveEndDate($fromDate, $daysOfTravel, $halfDay);
        $dateRangeStr = $this->formatDateRangeForPdf($fromDate, $endDate, $halfDay);
 
        $pdf->SetXY(55, 140.5);
        $pdf->Write(0, $dateRangeStr);

        // Days of Travel (with half-day period if applicable)
        $pdf->SetXY(58, 148);
        $hasHalfDay = fmod($daysOfTravel, 1) !== 0.0;
        $daysText   = $daysOfTravel == 1 ? 'day' : 'days';
 
        if ($hasHalfDay && $halfDay && $halfDay !== 'full') {
            $pdf->Write(0, "{$daysOfTravel} {$daysText} (" . ucfirst($halfDay) . ')');
        } else {
            $pdf->Write(0, "{$daysOfTravel} {$daysText}");
        }

        // Time of Travel
        $pdf->SetXY(169, 140.5); 
        $timeObj = Carbon::parse($data['time_of_travel']);
        $displayTime = $timeObj->format('h:i A');
        $pdf->Write(0, $displayTime);

        // Requestor Signature [Sgd.]
        $pdf->SetFont('BookOS', 'I', 11);
        $pdf->SetXY(105, 159);
        $pdf->Write(0, 'Sgd.');

        $pdf->SetFont('BookOS', 'B', 11);
        $pdf->SetXY(90, 164);
        $pdf->Write(0, strtoupper($user->name));

        return $pdf;
    }
}