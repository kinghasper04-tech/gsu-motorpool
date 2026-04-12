<?php

namespace App\Http\Controllers\Admin;

use Inertia\Inertia;
use Inertia\Response;
use App\Models\Driver;
use App\Models\Vehicle;
use App\Models\Assignment;
use App\Mail\RequestApproved;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use App\Http\Controllers\Controller;
use App\Services\NotificationService;
use Illuminate\Support\Facades\Mail;
use Illuminate\Http\RedirectResponse;
use App\Models\Request as VehicleRequest;
use Illuminate\Http\Request as HttpRequest;
use Illuminate\Support\Facades\Storage;
use setasign\Fpdi\Fpdi;
use Carbon\Carbon;

class ApprovalController extends Controller
{
    /**
     * Unified Request Management - All requests in one view with tabs
     */
    public function requestManagement(): Response
    {
        $pendingRequests = VehicleRequest::where('status', VehicleRequest::STATUS_ASSIGNED)
            ->where('forwarded_for_decline', false)
            ->with(['user', 'vehicle', 'driver', 'assignment'])
            ->orderBy('created_at', 'asc')
            ->get();

        $forwardedRequests = VehicleRequest::where('status', VehicleRequest::STATUS_ASSIGNED)
            ->where('forwarded_for_decline', true)
            ->with(['user', 'vehicle', 'driver', 'assignment'])
            ->orderBy('created_at', 'asc')
            ->get();

        $approvedRequests = VehicleRequest::where('status', VehicleRequest::STATUS_APPROVED)
            ->with(['user', 'vehicle', 'driver', 'assignment'])
            ->orderBy('updated_at', 'desc')
            ->get();

        $declinedRequests = VehicleRequest::where('status', VehicleRequest::STATUS_DECLINED)
            ->with(['user', 'vehicle', 'driver', 'assignment'])
            ->orderBy('updated_at', 'desc')
            ->get();

        $completedRequests = VehicleRequest::where('status', VehicleRequest::STATUS_COMPLETED)
            ->with(['user', 'vehicle', 'driver', 'assignment'])
            ->orderBy('updated_at', 'desc')
            ->get();
        
        $cancelledRequests = VehicleRequest::where('status', VehicleRequest::STATUS_CANCELLED)
            ->with(['user', 'vehicle', 'driver'])
            ->orderBy('cancelled_at', 'desc')
            ->get();

        return Inertia::render('Admin/RequestManagement', [
            'pendingRequests' => $pendingRequests,
            'forwardedRequests' => $forwardedRequests,
            'approvedRequests' => $approvedRequests,
            'declinedRequests' => $declinedRequests,
            'completedRequests' => $completedRequests,
            'cancelledRequests' => $cancelledRequests,
        ]);
    }

    /**
     * Upload signature
     */
    public function uploadSignature(HttpRequest $request): RedirectResponse
    {
        try {
            $validated = $request->validate([
                'signature' => 'required|image|mimes:png|max:2048'
            ]);

            $user = auth()->user();

            // Delete old signature if exists
            if ($user->signature_path) {
                Storage::disk('public')->delete($user->signature_path);
            }

            // Store new signature
            $path = $request->file('signature')->store('signatures', 'public');

            // Update user record
            $user->update([
                'signature_path' => $path
            ]);

            return redirect()->back()->with('success', 'Signature saved successfully');
        } catch (\Exception $e) {
            Log::error('Signature upload failed: ' . $e->getMessage(), [
                'user_id' => auth()->id(),
                'trace' => $e->getTraceAsString()
            ]);

            return redirect()->back()->with('error', 'Failed to save signature: ' . $e->getMessage());
        }
    }

    /**
     * Preview Approval/Decline PDF before confirming
     */
    public function previewApproval(HttpRequest $httpRequest, $id)
    {
        $action = $httpRequest->query('action'); // 'approve' or 'decline'
        $declineReason = urldecode($httpRequest->query('decline_reason', ''));

        $request = VehicleRequest::with(['user', 'vehicle', 'driver', 'assignment'])->findOrFail($id);
        $vehicle = $request->vehicle;
        $driver = $request->driver;

        // Generate PDF with preview data
        $pdf = $this->generateApprovalPdf($request, $request->vehicle ?? null, $request->driver ?? null, $action, $declineReason, auth()->user());

        return response($pdf->Output('S'))
            ->header('Content-Type', 'application/pdf')
            ->header('Content-Disposition', 'inline; filename="Approval_Preview_'.$id.'.pdf"');
    }

    /**
     * Approve a request
     */
    public function approve($id): RedirectResponse
    {
        try {
            DB::beginTransaction();

            $request = VehicleRequest::with(['user', 'vehicle', 'driver', 'approver'])->findOrFail($id);

            // Ensure request is in assigned status
            if ($request->status !== VehicleRequest::STATUS_ASSIGNED) {
                return back()->withErrors(['error' => 'Only assigned requests can be approved.']);
            }

            if (!$request->vehicle || !$request->driver) {
                return back()->withErrors([
                    'error' => 'This request cannot be approved because no vehicle or driver is assigned.'
                ]);
            }

            $request->update([
                'status' => VehicleRequest::STATUS_APPROVED,
                'approved_at' => now(),
                'approved_by' => auth()->id(),
            ]);

            // Update assignment record if needed
            if ($request->assignment) {
                $request->assignment->update([
                    'updated_at' => now(),
                ]);
            }

            // Generate PDF for email attachment
            $pdf = $this->generateApprovalPdf(
                $request, 
                $request->vehicle, 
                $request->driver, 
                'approve', 
                '', 
                auth()->user()
            );
            $pdfContent = $pdf->Output('S'); // Get PDF as string

            DB::commit();

            $notificationService = app(NotificationService::class);

            // Send in-app notification
            $notificationService->notifyClient($request, 'approved');

            // Notify ticket admin
            $notificationService->notifyTicketAdmin($request);

            // Send email with PDF attachment
            try {
                // Reload the request with fresh relationships for the email
                $request->load(['user', 'vehicle', 'driver', 'approver']);
                
                Mail::to($request->user->email)->send(new RequestApproved($request, $pdfContent));
                
                Log::info('Approval email sent successfully', [
                    'request_id' => $request->id,
                    'user_email' => $request->user->email,
                ]);

                $successMessage = 'Request approved successfully. Email notification sent to ' . $request->user->email;
            } catch (\Exception $e) {
                Log::warning('Failed to send approval email', [
                    'request_id' => $request->id,
                    'user_email' => $request->user->email,
                    'error' => $e->getMessage(),
                ]);

                $successMessage = 'Request approved successfully. ⚠️ Email notification failed to send.';
            }

            return redirect()->route('admin.requests.management')
                ->with('success', $successMessage);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Request approval failed: ' . $e->getMessage(), [
                'request_id' => $id,
                'user_id' => auth()->id(),
                'trace' => $e->getTraceAsString()
            ]);

            return back()->withErrors(['error' => 'Approval failed: ' . $e->getMessage()]);
        }
    }

    /**
     * Decline a request
     */
    public function decline(HttpRequest $httpRequest, $id): RedirectResponse
    {
        $validated = $httpRequest->validate([
            'decline_reason' => ['required', 'string', 'min:5', 'max:500'],
        ]);

        try {
            DB::beginTransaction();

            $request = VehicleRequest::findOrFail($id);

            Log::info('Attempting to decline request', [
                'request_id' => $id,
                'current_status' => $request->status,
                'user_id' => auth()->id(),
                'reason' => $validated['decline_reason']
            ]);

            // Ensure request is in assigned status
            if ($request->status !== VehicleRequest::STATUS_ASSIGNED) {
                Log::warning('Request decline failed - invalid status', [
                    'request_id' => $id,
                    'current_status' => $request->status,
                    'expected_status' => VehicleRequest::STATUS_ASSIGNED
                ]);
                throw new \Exception('Only assigned requests can be declined. Current status: ' . $request->status);
            }

            // Update the request
            $request->update([
                'status' => VehicleRequest::STATUS_DECLINED,
                'declined_at' => now(),
                'declined_by' => auth()->id(),
                'decline_reason' => $validated['decline_reason'],
            ]);

            // Update assignment record if it exists
            if ($request->assignment) {
                $request->assignment->update([
                    'declined_at' => now(),
                    'declined_by' => auth()->id(),
                    'decline_reason' => $validated['decline_reason'],
                ]);
                Log::info('Assignment record updated for declined request', [
                    'assignment_id' => $request->assignment->id
                ]);
            }

            DB::commit();

            Log::info('Request declined successfully', [
                'request_id' => $id,
                'user_id' => auth()->id()
            ]);

            // Notify client about decline
            app(NotificationService::class)->notifyClient($request, 'declined');

            return redirect()->route('admin.requests.management')
                ->with('success', 'Request declined successfully.');
        } catch (\Illuminate\Validation\ValidationException $e) {
            DB::rollBack();
            Log::error('Request decline validation failed', [
                'request_id' => $id,
                'errors' => $e->errors()
            ]);
            return back()->withErrors($e->errors());
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Request decline failed: ' . $e->getMessage(), [
                'request_id' => $id,
                'user_id' => auth()->id(),
                'trace' => $e->getTraceAsString()
            ]);

            return back()->withErrors(['error' => 'Decline failed: ' . $e->getMessage()]);
        }
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
     * Dashboard showing approval statistics
     */
    public function dashboard(): Response
    {
        $this->autoCompleteRequests();
        // Stats
        $pendingApprovals = VehicleRequest::where('status', VehicleRequest::STATUS_ASSIGNED)
            ->count();

        $approvedToday = VehicleRequest::where('status', VehicleRequest::STATUS_APPROVED)
            ->whereDate('approved_at', today())
            ->count();

        $declinedThisWeek = VehicleRequest::where('status', VehicleRequest::STATUS_DECLINED)
            ->whereBetween('declined_at', [now()->startOfWeek(), now()->endOfWeek()])
            ->count();

        // Approval rate (this month)
        $approvedThisMonth = VehicleRequest::where('status', VehicleRequest::STATUS_APPROVED)
            ->whereMonth('approved_at', now()->month)
            ->whereYear('approved_at', now()->year)
            ->count();

        $declinedThisMonth = VehicleRequest::where('status', VehicleRequest::STATUS_DECLINED)
            ->whereMonth('declined_at', now()->month)
            ->whereYear('declined_at', now()->year)
            ->count();

        $totalDecisionsThisMonth = $approvedThisMonth + $declinedThisMonth;
        $approvalRate = $totalDecisionsThisMonth > 0 
            ? round(($approvedThisMonth / $totalDecisionsThisMonth) * 100, 1)
            : 0;

        // Pending queue (10 oldest assigned requests - FIFO)
        $pendingQueue = VehicleRequest::where('status', VehicleRequest::STATUS_ASSIGNED)
            ->with(['user', 'vehicle', 'driver'])
            ->orderBy('updated_at', 'asc')
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
                    'assigned_at' => $request->updated_at->format('M d, Y H:i'),
                    'days_waiting' => now()->diffInDays($request->updated_at),
                    'travel_date' => $request->date_of_travel,
                ];
            });

        // Recent decisions (last 7 approvals/declines)
        $recentDecisions = VehicleRequest::whereIn('status', [
                VehicleRequest::STATUS_APPROVED,
                VehicleRequest::STATUS_DECLINED
            ])
            ->with(['user'])
            ->orderByRaw('COALESCE(approved_at, declined_at) DESC')
            ->limit(7)
            ->get()
            ->map(function ($request) {
                $timestamp = $request->status === VehicleRequest::STATUS_APPROVED 
                    ? $request->approved_at 
                    : $request->declined_at;

                return [
                    'id' => $request->id,
                    'requester' => $request->user->name,
                    'destination' => $request->destination,
                    'status' => $request->status,
                    'decision_at' => $timestamp->format('M d, Y H:i'),
                    'decline_reason' => $request->decline_reason,
                ];
            });

        // Urgent requests (travel date within 48 hours and still assigned)
        $urgentRequests = VehicleRequest::where('status', VehicleRequest::STATUS_ASSIGNED)
            ->where('start_datetime', '<=', now()->addHours(48))
            ->where('start_datetime', '>=', now())
            ->with(['user', 'vehicle', 'driver'])
            ->orderBy('start_datetime', 'asc')
            ->get()
            ->map(function ($request) {
                return [
                    'id' => $request->id,
                    'requester' => $request->user->name,
                    'destination' => $request->destination,
                    'start_datetime' => $request->start_datetime->format('M d, Y H:i'),
                    'hours_until' => now()->diffInHours($request->start_datetime),
                ];
            });

        return Inertia::render('Dashboard/ApprovalAdminDashboard', [
            'data' => [
                'pendingApprovals' => $pendingApprovals,
                'approvedToday' => $approvedToday,
                'declinedThisWeek' => $declinedThisWeek,
                'approvalRate' => $approvalRate,
                'pendingQueue' => $pendingQueue,
                'recentDecisions' => $recentDecisions,
                'urgentRequests' => $urgentRequests,
            ],
        ]);
    }

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

    /**
     * Generate Approval/Decline PDF
     */
    private function generateApprovalPdf(VehicleRequest $request, ?Vehicle $vehicle, ?Driver $driver, string $action, string $declineReason, $approvalAdmin): Fpdi
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
        // Request No.
        $pdf->SetXY(165, 52);
        $pdf->Write(0, $request->id);

        // Date Requested
        $pdf->SetXY(171, 59);
        $pdf->Write(0, $request->created_at->format('M. j, Y'));

        // Time Requested
        $pdf->SetXY(172, 66.5);
        $pdf->Write(0, $request->created_at->format('h:i A'));

        // Name
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
        $pdf->SetXY(58, 147.5);
        $pdf->Write(0, $request->getFormattedDuration());

        // Time of Travel
        $pdf->SetXY(169, 140.5);
        $timeObj = Carbon::parse($request->time_of_travel);
        $displayTime = $timeObj->format('h:i A');
        $pdf->Write(0, $displayTime);

        // ASSIGNMENT DETAILS
        // Assigned Vehicle
        if ($vehicle) {
            // Assigned Vehicle
            $pdf->SetFont('BookOS', '', 10);
            $pdf->SetXY(148, 191.5);
            $pdf->MultiCell(56, 4, $vehicle->description, 0, 'L');
        } else {
            // Show "Not Assigned" or leave blank
            $pdf->SetFont('BookOS', '', 10);
            $pdf->SetXY(148, 194);
            $pdf->Write(0, 'Not Assigned');
        }

        if ($driver) {
            // Assigned Driver
            $pdf->SetXY(39, 194);
            $pdf->Write(0, $driver->name);
        } else {
            // Show "Not Assigned" or leave blank
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

        // APPROVAL/DECLINE SECTION
        // Approval Status Checkmarks
        $pdf->SetFont('ZapfDingbats');
        $pdf->SetFontSize(15);

        if ($action === 'approve') {
            $pdf->SetXY(25.5, 228);
            $pdf->Write(0, '4');
        } elseif ($action === 'decline') {
            $pdf->SetXY(82.5, 228);
            $pdf->Write(0, '4');
            
            // Decline Reason
            $pdf->SetFont('BookOS', '', 11);
            $pdf->SetXY(127, 228);
            $pdf->Write(0, $declineReason);
        }

        // Approval Admin Signature
        $pdf->SetFont('BookOS', 'I', 11);
        $pdf->SetXY(105, 242);
        $pdf->Write(0, 'Sgd.');

        return $pdf;
    }
}