<?php

namespace App\Services;

use App\Notifications\ReminderNotification;
use Carbon\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class TelegramService
{
    public const DASHBOARD_HINT = 'Lihat detail lengkap tugas di dashboard Anda.';

    /**
     * Telegram rejects messages longer than 4096 characters, so descriptions
     * are collapsed to a single line and truncated before sending.
     */
    private const DESCRIPTION_LIMIT = 300;

    public function buildTaskCreatedMessage(string $courseContent, string $task, string $deadline, ?string $description = null): string
    {
        $dashboardUrl = $this->getDashboardUrl();
        $message = [
            '*Notifikasi Tugas Dibuat*',
            '',
            '*Mata Kuliah:* '.$this->escapeMarkdownV2($courseContent),
            '*Tugas:* '.$this->escapeMarkdownV2($task),
            '*Tenggat:* '.$this->escapeMarkdownV2(Carbon::parse($deadline)->format('j F Y')),
        ];

        $descriptionLine = $this->descriptionText($description);

        if ($descriptionLine !== null) {
            $message[] = '*Deskripsi:* '.$this->escapeMarkdownV2($descriptionLine);
        }

        $message[] = '';
        $message[] = $this->escapeMarkdownV2(self::DASHBOARD_HINT);
        $message[] = '';
        $message[] = '[Buka dashboard]('.$dashboardUrl.')';

        return implode("\n", $message);
    }

    public function buildTaskCompletedMessage(string $courseContent, string $task, ?string $description = null): string
    {
        $dashboardUrl = $this->getDashboardUrl();
        $message = [
            '*Notifikasi Tugas Selesai*',
            '',
            '*Mata Kuliah:* '.$this->escapeMarkdownV2($courseContent),
            '*Tugas:* '.$this->escapeMarkdownV2($task),
        ];

        $descriptionLine = $this->descriptionText($description);

        if ($descriptionLine !== null) {
            $message[] = '*Deskripsi:* '.$this->escapeMarkdownV2($descriptionLine);
        }

        $message[] = '';
        $message[] = $this->escapeMarkdownV2(self::DASHBOARD_HINT);
        $message[] = '';
        $message[] = '[Buka dashboard]('.$dashboardUrl.')';

        return implode("\n", $message);
    }

    /**
     * @param  array<int, array<string, mixed>>  $notifications
     */
    public function buildReminderSummaryMessage(array $notifications): string
    {
        $dashboardUrl = $this->getDashboardUrl();

        $notifications = ReminderNotification::sortByPriorityAndDeadline($notifications);

        $count = count($notifications);
        $taskWord = 'tugas';
        $message = [
            '*Notifikasi Pengingat Tugas*',
            '',
            'Anda memiliki *'.$this->escapeMarkdownV2((string) $count).'* '.$this->escapeMarkdownV2($taskWord).' tertunda',
            '',
        ];

        foreach ($notifications as $index => $notification) {
            $message[] = '*Pengingat '.$this->escapeMarkdownV2((string) ($index + 1)).'*';

            if (! empty($notification['priority'])) {
                $message[] = '*Prioritas*';
            }

            $message[] = '*Tugas:* '.$this->escapeMarkdownV2((string) $notification['task']);
            $message[] = '*Mata Kuliah:* '.$this->escapeMarkdownV2((string) $notification['course_content']);
            $message[] = '*Tenggat:* '.$this->escapeMarkdownV2($this->deadlineText($notification));

            $descriptionLine = $this->descriptionText($notification['description'] ?? null);

            if ($descriptionLine !== null) {
                $message[] = '*Deskripsi:* '.$this->escapeMarkdownV2($descriptionLine);
            }

            $message[] = '';
        }

        $message[] = $this->escapeMarkdownV2(self::DASHBOARD_HINT);
        $message[] = '';
        $message[] = '[Buka dashboard]('.$dashboardUrl.')';

        return implode("\n", $message);
    }

    /**
     * Collapse a description into a single printable line.
     *
     * Returns null for an empty description so the label is omitted entirely.
     */
    private function descriptionText(?string $description): ?string
    {
        if ($description === null) {
            return null;
        }

        $collapsed = trim(preg_replace('/\s+/u', ' ', $description) ?? '');

        if ($collapsed === '') {
            return null;
        }

        if (mb_strlen($collapsed) > self::DESCRIPTION_LIMIT) {
            $collapsed = mb_substr($collapsed, 0, self::DESCRIPTION_LIMIT).'…';
        }

        return $collapsed;
    }

    /**
     * @param  array<string, mixed>  $notification
     */
    private function deadlineText(array $notification): string
    {
        $text = Carbon::parse((string) $notification['deadline'])->format('j F Y');

        if (! empty($notification['deadline_label'])) {
            $text .= ' ('.$notification['deadline_label'].')';
        }

        return $text;
    }

    public function sendTestNotification(string $chatId, string $channel): bool
    {
        $dashboardUrl = $this->getDashboardUrl();
        $message = [
            '*Notifikasi Uji*',
            '',
            'Ini adalah notifikasi uji dari Task Reminder',
            '*Channel:* '.$this->escapeMarkdownV2($channel),
            '*Status:* Pengaturan Telegram berfungsi',
            '',
            '[Buka dashboard]('.$dashboardUrl.')',
        ];

        return $this->sendMessage($chatId, implode("\n", $message));
    }

    public function sendMessage(string $chatId, string $message, string $parseMode = 'MarkdownV2'): bool
    {
        $token = (string) config('services.telegram.bot_token');

        if ($token === '') {
            Log::warning('Telegram notification skipped because TELEGRAM_BOT_TOKEN is not configured.');

            return false;
        }

        try {
            $payload = [
                'chat_id' => $chatId,
                'text' => $message,
                'disable_web_page_preview' => true,
                'parse_mode' => $parseMode,
            ];

            $response = Http::timeout(10)
                ->asForm()
                ->post("https://api.telegram.org/bot{$token}/sendMessage", $payload);

            if ($response->failed()) {
                Log::warning('Failed to send Telegram notification.', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return false;
            }

            return true;
        } catch (\Throwable $exception) {
            Log::warning('Telegram notification threw an exception.', [
                'error' => $exception->getMessage(),
            ]);

            return false;
        }
    }

    private function getDashboardUrl(): string
    {
        $baseUrl = trim((string) config('app.frontend_url'));

        if ($baseUrl === '') {
            $baseUrl = trim((string) config('app.url'));
        }

        return rtrim($baseUrl, '/').'/dashboard';
    }

    private function escapeMarkdownV2(string $value): string
    {
        $escaped = str_replace('\\', '\\\\', $value);

        return str_replace(
            ['_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!'],
            ['\\_', '\\*', '\\[', '\\]', '\\(', '\\)', '\\~', '\\`', '\\>', '\\#', '\\+', '\\-', '\\=', '\\|', '\\{', '\\}', '\\.', '\\!'],
            $escaped
        );
    }
}
