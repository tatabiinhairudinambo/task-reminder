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

// ─── message splitting (Telegram 4096-character limit) ───

test('buildReminderSummaryMessages returns a single message for a short digest', function () {
    $notifications = [
        ['task' => 'PR 1', 'course_content' => 'Kalkulus', 'deadline' => '2025-06-15', 'deadline_label' => '3 hari lagi'],
    ];

    $messages = $this->service->buildReminderSummaryMessages($notifications);

    expect($messages)->toHaveCount(1)
        ->and($messages[0])->toContain('Notifikasi Pengingat Tugas')
        ->and($messages[0])->not->toContain('Pesan 1 dari');
});

test('buildReminderSummaryMessages splits a digest above the telegram limit', function () {
    $notifications = [];

    for ($i = 1; $i <= 20; $i++) {
        $notifications[] = [
            'task' => 'Tugas Besar Bab '.$i,
            'course_content' => 'Pemrograman Web Lanjut',
            'deadline' => '2026-10-22',
            'deadline_label' => '30 hari lagi',
            'description' => str_repeat('Kerjakan analisis dan implementasi fitur pada bab ini. ', 6),
            'priority' => $i % 3 === 0,
        ];
    }

    $messages = $this->service->buildReminderSummaryMessages($notifications);

    expect(count($messages))->toBeGreaterThan(1);

    foreach ($messages as $message) {
        expect(mb_strlen($message))->toBeLessThanOrEqual(4096)
            ->and($message)->toContain('Notifikasi Pengingat Tugas')
            ->and($message)->toContain('Lihat detail lengkap tugas di dashboard Anda');
    }
});

test('buildReminderSummaryMessages numbers every chunk when split', function () {
    $notifications = [];

    for ($i = 1; $i <= 20; $i++) {
        $notifications[] = [
            'task' => 'Tugas '.$i,
            'course_content' => 'Pemrograman Web Lanjut',
            'deadline' => '2026-10-22',
            'deadline_label' => '30 hari lagi',
            'description' => str_repeat('Kerjakan analisis dan implementasi fitur pada bab ini. ', 6),
        ];
    }

    $messages = $this->service->buildReminderSummaryMessages($notifications);
    $total = count($messages);

    expect($total)->toBeGreaterThan(1);

    foreach ($messages as $index => $message) {
        expect($message)->toContain('Pesan '.($index + 1).' dari '.$total);
    }
});

test('buildReminderSummaryMessages keeps every task across the split', function () {
    $notifications = [];

    for ($i = 1; $i <= 20; $i++) {
        $notifications[] = [
            'task' => 'Tugas Unik '.$i,
            'course_content' => 'Pemrograman Web Lanjut',
            'deadline' => '2026-10-22',
            'deadline_label' => '30 hari lagi',
            'description' => str_repeat('Kerjakan analisis dan implementasi fitur pada bab ini. ', 6),
        ];
    }

    $messages = $this->service->buildReminderSummaryMessages($notifications);
    $combined = implode("\n", $messages);

    for ($i = 1; $i <= 20; $i++) {
        expect($combined)->toContain('Tugas Unik '.$i);
    }
});

// ─── Indonesian dates ───

test('reminder messages render deadlines in Indonesian', function () {
    $notifications = [
        ['task' => 'PR 1', 'course_content' => 'Kalkulus', 'deadline' => '2026-10-22', 'deadline_label' => '30 hari lagi'],
    ];

    $text = $this->service->buildReminderSummaryMessage($notifications);

    expect($text)->toContain('22 Oktober 2026')
        ->and($text)->not->toContain('October');
});

test('task created message renders the deadline in Indonesian', function () {
    $text = $this->service->buildTaskCreatedMessage('Kalkulus', 'PR Bab 1', '2026-10-22');

    expect($text)->toContain('22 Oktober 2026')
        ->and($text)->not->toContain('October');
});
