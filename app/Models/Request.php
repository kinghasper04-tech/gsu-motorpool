<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Request extends Model
{
    use HasFactory;

    // Status constants
    const STATUS_PENDING = 'pending';
    const STATUS_ASSIGNED = 'assigned';
    const STATUS_APPROVED = 'approved';
    const STATUS_DECLINED = 'declined';
    const STATUS_COMPLETED = 'completed';
    const STATUS_CANCELLED = 'cancelled';

    // Half-day period constants
    const HALF_DAY_MORNING = 'morning';
    const HALF_DAY_AFTERNOON = 'afternoon';
    const HALF_DAY_FULL = 'full';

    protected $fillable = [
        'user_id',
        'destination',
        'purpose',
        'vehicle_id',
        'driver_id',
        'authorized_passengers',
        'date_of_travel',
        'days_of_travel',
        'half_day_period',
        'time_of_travel',
        'start_datetime',
        'end_datetime',
        'status',
        'forwarded_for_decline',
        'forwarded_decline_reason',
        'approved_at',
        'approved_by',
        'declined_at',
        'declined_by',
        'decline_reason',
        'trip_ticket_number',
        'ticket_generated_at',
        'ticket_sent_at',
        'ticket_sent_to',
        'cancelled_at',
        'cancelled_by',
    ];

    protected $casts = [
        'start_datetime' => 'datetime',
        'end_datetime' => 'datetime',
        'date_of_travel' => 'date',
        'approved_at' => 'datetime',
        'declined_at' => 'datetime',
        'ticket_generated_at' => 'datetime',
        'days_of_travel' => 'decimal:1',
        'cancelled_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function vehicle()
    {
        return $this->belongsTo(Vehicle::class);
    }

    public function driver()
    {
        return $this->belongsTo(Driver::class);
    }

    public function assignment()
    {
        return $this->hasOne(Assignment::class);
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function decliner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'declined_by');
    }

    public function isPending(): bool
    {
        return $this->status === self::STATUS_PENDING;
    }

    public function isAssigned(): bool
    {
        return $this->status === self::STATUS_ASSIGNED;
    }

    public function isApproved(): bool
    {
        return $this->status === self::STATUS_APPROVED;
    }

    public function isDeclined(): bool
    {
        return $this->status === self::STATUS_DECLINED;
    }

    public function isCompleted(): bool
    {
        return $this->status === self::STATUS_COMPLETED;
    }

    /**
     * Check if this is a half-day request
     */
    public function isHalfDay(): bool
    {
        return fmod($this->days_of_travel, 1) !== 0.0;
    }

    /**
     * Get formatted duration display
     * Examples: "1 day", "0.5 days (Morning)", "2.5 days (Afternoon)"
     */
    public function getFormattedDuration(): string
    {
        $days = $this->days_of_travel;
        $dayText = $days == 1 ? 'day' : 'days';
        
        if ($this->isHalfDay() && $this->half_day_period) {
            return "{$days} {$dayText} (" . ucfirst($this->half_day_period) . ")";
        }
        
        return "{$days} {$dayText}";
    }

    /**
     * Check if request conflicts with existing assignments
     */
    public function hasConflicts()
    {
        return self::where('id', '!=', $this->id)
            ->where(function($query) {
                $query->where('vehicle_id', $this->vehicle_id)
                      ->orWhere('driver_id', $this->driver_id);
            })
            ->where(function($query) {
                $query->whereBetween('start_datetime', [$this->start_datetime, $this->end_datetime])
                      ->orWhereBetween('end_datetime', [$this->start_datetime, $this->end_datetime])
                      ->orWhere(function($q) {
                          $q->where('start_datetime', '<=', $this->start_datetime)
                            ->where('end_datetime', '>=', $this->end_datetime);
                      });
            })
            ->whereIn('status', [self::STATUS_ASSIGNED, self::STATUS_APPROVED])
            ->exists();
    }

    public function isCancelled(): bool
    {
        return $this->status === self::STATUS_CANCELLED;
    }

    public function canceller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cancelled_by');
    }
}