<?php

use App\Models\CourseContent;
use App\Models\Setting;
use App\Models\Task;
use App\Models\User;
use App\Notifications\ReminderNotification;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;

function makeCourseContent(User $user): CourseContent
{
    return CourseContent::create([
        'semester' => 'Ganjil 2026/2027',
        'code' => 'TMP101',
        'course_content' => 'Kalkulus',
        'credits' => 3,
        'lecturer' => 'Dosen Uji',
        'day' => 'Senin',
        'hour_start' => '07:30',
        'hour_end' => '09:10',
        'user_id' => $user->id,
    ]);
}

test('reminder command notifies users with a task due today', function () {
    Notification::fake();

    $user = User::factory()->create();
    Setting::create([
        'deadline_notification' => '3 hari lagi',
        'task_created_notification' => 1,
        'task_completed_notification' => 1,
        'notification_channel' => Setting::CHANNEL_EMAIL,
        'user_id' => $user->id,
    ]);

    Task::create([
        'task' => 'Tugas Hari Ini',
        'deadline' => Carbon::now()->toDateString(),
        'status' => 0,
        'priority' => 0,
        'user_id' => $user->id,
        'course_content_id' => makeCourseContent($user)->id,
    ]);

    $this->artisan('notifications:reminder')->assertExitCode(0);

    Notification::assertSentTo($user, ReminderNotification::class, function (ReminderNotification $notification) {
        return $notification->notifications[0]['task'] === 'Tugas Hari Ini'
            && $notification->notifications[0]['deadline'] === Carbon::now()->toDateString();
    });
});

test('reminder command includes priority tasks even with a distant deadline', function () {
    Notification::fake();

    $user = User::factory()->create();
    Setting::create([
        'deadline_notification' => '3 hari lagi',
        'task_created_notification' => 1,
        'task_completed_notification' => 1,
        'notification_channel' => Setting::CHANNEL_EMAIL,
        'user_id' => $user->id,
    ]);

    Task::create([
        'task' => 'Tugas Prioritas',
        'deadline' => Carbon::now()->addDays(30)->toDateString(),
        'status' => 0,
        'priority' => 1,
        'user_id' => $user->id,
        'course_content_id' => makeCourseContent($user)->id,
    ]);

    $this->artisan('notifications:reminder')->assertExitCode(0);

    Notification::assertSentTo($user, ReminderNotification::class, function (ReminderNotification $notification) {
        return $notification->notifications[0]['task'] === 'Tugas Prioritas'
            && $notification->notifications[0]['priority'] === true;
    });
});

test('reminder command skips completed tasks', function () {
    Notification::fake();

    $user = User::factory()->create();
    Setting::create([
        'deadline_notification' => '3 hari lagi',
        'task_created_notification' => 1,
        'task_completed_notification' => 1,
        'notification_channel' => Setting::CHANNEL_EMAIL,
        'user_id' => $user->id,
    ]);

    Task::create([
        'task' => 'Tugas Selesai',
        'deadline' => Carbon::now()->toDateString(),
        'status' => 1,
        'priority' => 0,
        'user_id' => $user->id,
        'course_content_id' => makeCourseContent($user)->id,
    ]);

    $this->artisan('notifications:reminder')->assertExitCode(0);

    Notification::assertNotSentTo($user, ReminderNotification::class);
});

test('reminder payload keeps a parseable ISO deadline', function () {
    Notification::fake();

    $user = User::factory()->create();
    Setting::create([
        'deadline_notification' => '3 hari lagi',
        'task_created_notification' => 1,
        'task_completed_notification' => 1,
        'notification_channel' => Setting::CHANNEL_EMAIL,
        'user_id' => $user->id,
    ]);

    $deadline = Carbon::now()->toDateString();

    Task::create([
        'task' => 'Tugas Tanggal',
        'deadline' => $deadline,
        'status' => 0,
        'priority' => 0,
        'user_id' => $user->id,
        'course_content_id' => makeCourseContent($user)->id,
    ]);

    $this->artisan('notifications:reminder')->assertExitCode(0);

    Notification::assertSentTo($user, ReminderNotification::class, function (ReminderNotification $notification) use ($deadline) {
        return $notification->notifications[0]['deadline'] === $deadline;
    });
});

test('reminder notification renders an Indonesian deadline in mail and telegram', function () {
    $user = User::factory()->create();

    $notification = new ReminderNotification([
        ['task' => 'PR 1', 'course_content' => 'Kalkulus', 'deadline' => '2026-10-22', 'deadline_label' => '30 hari lagi'],
    ]);

    $mail = $notification->toMail($user);

    expect($mail->viewData['notifications'][0]['deadline'])->toBe('22 Oktober 2026')
        ->and(implode("\n", $notification->toTelegram($user)))->toContain('22 Oktober 2026');
});
