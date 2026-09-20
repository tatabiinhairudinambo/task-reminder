<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * The deadline reminder offsets were stored as English labels
     * ("5 days left"). They are now rendered in Indonesian, so migrate the
     * stored values to keep the Settings dropdown showing the right option.
     */
    public function up(): void
    {
        $map = [
            '1 days left' => '1 hari lagi',
            '1 day left' => '1 hari lagi',
            '2 days left' => '2 hari lagi',
            '3 days left' => '3 hari lagi',
            '4 days left' => '4 hari lagi',
            '5 days left' => '5 hari lagi',
            '6 days left' => '6 hari lagi',
            '7 days left' => '7 hari lagi',
        ];

        foreach ($map as $from => $to) {
            DB::table('settings')
                ->where('deadline_notification', $from)
                ->update(['deadline_notification' => $to]);
        }
    }

    public function down(): void
    {
        $map = [
            '1 hari lagi' => '1 day left',
            '2 hari lagi' => '2 days left',
            '3 hari lagi' => '3 days left',
            '4 hari lagi' => '4 days left',
            '5 hari lagi' => '5 days left',
            '6 hari lagi' => '6 days left',
            '7 hari lagi' => '7 days left',
        ];

        foreach ($map as $from => $to) {
            DB::table('settings')
                ->where('deadline_notification', $from)
                ->update(['deadline_notification' => $to]);
        }
    }
};
