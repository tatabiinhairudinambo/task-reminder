<?php

use App\Services\TelegramService;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

uses(TestCase::class);

beforeEach(function () {
    config()->set('services.telegram.bot_token', 'dummy-token');
    config()->set('app.frontend_url', 'http://localhost:3000');
    $this->service = new TelegramService;
});

// ─── sendMessage (via public methods) ───

test('buildTaskCreatedMessage posts formatted message to telegram', function () {
    $text = $this->service->buildTaskCreatedMessage('Kalkulus', 'PR Bab 1', '2025-06-15');

    expect($text)->toContain('Notifikasi Tugas Dibuat')
        ->and($text)->toContain('Kalkulus')
        ->and($text)->toContain('Lihat detail lengkap tugas di dashboard Anda');
});

test('buildTaskCreatedMessage excludes description', function () {
    $text = $this->service->buildTaskCreatedMessage('Kalkulus', 'PR', '2025-06-15');

    expect($text)->not->toContain('Deskripsi:');
});

test('buildTaskCompletedMessage posts completed notification without description', function () {
    $text = $this->service->buildTaskCompletedMessage('Fisika', 'Lab Report');

    expect($text)->toContain('Notifikasi Tugas Selesai')
        ->and($text)->toContain('Fisika')
        ->and($text)->toContain('Lihat detail lengkap tugas di dashboard Anda')
        ->and($text)->not->toContain('Deskripsi:');
});

test('buildReminderSummaryMessage puts priority tasks first with marker', function () {
    $notifications = [
        ['task' => 'Later normal', 'course_content' => 'Kalkulus', 'deadline' => '2025-06-15', 'deadline_label' => '3 hari lagi'],
        ['task' => 'Urgent priority', 'course_content' => 'Fisika', 'deadline' => '2025-06-20', 'deadline_label' => '8 hari lagi', 'priority' => true],
    ];

    $text = $this->service->buildReminderSummaryMessage($notifications);

    expect($text)->toContain('*Prioritas*')
        ->and(strpos($text, 'Urgent priority'))->toBeLessThan(strpos($text, 'Later normal'));
});

test('buildReminderSummaryMessage posts multi-task reminder with descriptions', function () {
    $notifications = [
        ['task' => 'PR 1', 'course_content' => 'Kalkulus', 'deadline' => '2025-06-15', 'deadline_label' => '3 hari lagi', 'description' => 'Kerjakan bab 1'],
        ['task' => 'PR 2', 'course_content' => 'Fisika', 'deadline' => '2025-06-20', 'deadline_label' => '1 hari lagi', 'description' => 'Penting'],
    ];

    $text = $this->service->buildReminderSummaryMessage($notifications);

    expect($text)->toContain('Pengingat')
        ->and($text)->toContain('Kalkulus')
        ->and($text)->toContain('Fisika')
        ->and($text)->toContain('tertunda')
        ->and($text)->toContain('Lihat detail lengkap tugas di dashboard Anda')
        ->and($text)->toContain('\\(3 hari lagi\\)')
        ->and($text)->toContain('\\(1 hari lagi\\)')
        ->and($text)->toContain('Deskripsi:')
        ->and($text)->toContain('Kerjakan bab 1')
        ->and($text)->toContain('Penting');
});

test('buildReminderSummaryMessage omits description lines when tasks have none', function () {
    $notifications = [
        ['task' => 'PR 1', 'course_content' => 'Kalkulus', 'deadline' => '2025-06-15', 'deadline_label' => '3 hari lagi'],
    ];

    $text = $this->service->buildReminderSummaryMessage($notifications);

    expect($text)->not->toContain('Deskripsi:');
});

test('buildReminderSummaryMessage truncates very long descriptions', function () {
    $notifications = [
        ['task' => 'PR 1', 'course_content' => 'Kalkulus', 'deadline' => '2025-06-15', 'deadline_label' => '3 hari lagi', 'description' => str_repeat('a', 500)],
    ];

    $text = $this->service->buildReminderSummaryMessage($notifications);

    expect($text)->toContain('Deskripsi:')
        ->and($text)->toContain('…')
        ->and($text)->not->toContain(str_repeat('a', 500));
});

test('sendTestNotification returns true on success', function () {
    Http::fake([
        'api.telegram.org/*' => Http::response(['ok' => true], 200),
    ]);

    $result = $this->service->sendTestNotification('12345', 'telegram');

    expect($result)->toBeTrue();
});

test('sendTestNotification returns false on api failure', function () {
    Http::fake([
        'api.telegram.org/*' => Http::response(['ok' => false], 400),
    ]);

    $result = $this->service->sendTestNotification('12345', 'telegram');

    expect($result)->toBeFalse();
});

test('sendMessage returns false when bot token not configured', function () {
    config()->set('services.telegram.bot_token', '');

    $result = $this->service->sendTestNotification('12345', 'telegram');

    expect($result)->toBeFalse();
});
