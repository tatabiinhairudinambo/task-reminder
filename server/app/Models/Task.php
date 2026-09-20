<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Task extends Model
{
    protected $appends = ['deadline_label'];

    protected $fillable = [
        'task',
        'description',
        'deadline',
        'status',
        'priority',
        'user_id',
        'course_content_id',
    ];

    /**
     * Postgres returns native booleans while MySQL returns 0/1 for these
     * columns. Casting to integer keeps the API contract identical on both.
     */
    protected function casts(): array
    {
        return [
            'status' => 'integer',
            'priority' => 'integer',
        ];
    }

    public function getDeadlineLabelAttribute()
    {
        $deadline = Carbon::parse($this->deadline)->startOfDay();
        $now = Carbon::now()->startOfDay();

        if ($this->status == 1) {
            return 'Selesai';
        }

        if ($now->greaterThan($deadline)) {
            return 'Terlambat';
        }

        $diffInDays = (int) $now->diffInDays($deadline);

        if ($diffInDays == 0) {
            return 'Jatuh tempo hari ini';
        } elseif ($diffInDays == 1) {
            return '1 hari lagi';
        } else {
            return $diffInDays.' hari lagi';
        }
    }

    /**
     * Hex background color for the deadline badge in emails.
     * Mirrors the frontend getDeadlineBadgeClass() tiers.
     */
    public static function deadlineBadgeColor(?string $label): string
    {
        $normalized = strtolower(trim((string) $label));

        if (str_contains($normalized, 'selesai') || str_contains($normalized, 'completed')) {
            return '#16a34a';
        }

        if (
            str_contains($normalized, 'terlambat')
            || str_contains($normalized, 'overdue')
            || str_contains($normalized, 'hari ini')
            || str_contains($normalized, 'today')
        ) {
            return '#dc2626';
        }

        if (preg_match('/^(\d+)\s*hari/', $normalized, $matches) === 1) {
            $days = (int) $matches[1];

            if ($days <= 1) {
                return '#dc2626';
            }

            if ($days <= 5) {
                return '#d97706';
            }

            return '#64748b';
        }

        return '#64748b';
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function course_content(): BelongsTo
    {
        return $this->belongsTo(CourseContent::class);
    }
}
