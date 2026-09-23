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

    /**
     * Telegram counts message length in UTF-16 code units and rejects
     * anything above 4096.
     */
    private const MESSAGE_LIMIT = 4096;

    /**
     * Upper bound for the "Pesan X dari Y" suffix added to every chunk when
     * a reminder is split, reserved while measuring chunk sizes.
     */
    private const NUMBERING_LIMIT = 32;

    public function buildTaskCreatedMessage(string $courseContent, string $task, string $deadline, ?string $description = null): string
    {
        $dashboardUrl = $this->getDashboardUrl();
        $message = [
            '*Notifikasi Tugas Dibuat*',
            '',
            '*Mata Kuliah:* '.$this->escapeMarkdownV2($courseContent),
            '*Tugas:* '.$this->escapeMarkdownV2($task),
            '*Tenggat:* '.$this->escapeMarkdownV2(Carbon::parse($deadline)->translatedFormat('j F Y')),
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
        return $this->buildReminderSummaryMessages($notifications)[0];
    }

    /**
     * Split a reminder digest into one or more Telegram-sized messages.
     *
     * A student with many priority tasks can exceed Telegram's 4096-character
     * limit, which makes the API reject the whole message and the reminder is
     * silently lost. Each chunk repeats the header so every message stands
     * alone, and gets a "Pesan X dari Y" line when there is more than one.
     *
     * @param  array<int, array<string, mixed>>  $notifications
     * @return array<int, string>
     */
    public function buildReminderSummaryMessages(array $notifications): array
    {
        $dashboardUrl = $this->getDashboardUrl();

        $notifications = ReminderNotification::sortByPriorityAndDeadline($notifications);

        $count = count($notifications);

        $header = implode("\n", [
            '*Notifikasi Pengingat Tugas*',
            '',
            'Anda memiliki *'.$this->escapeMarkdownV2((string) $count).'* '.$this->escapeMarkdownV2('tugas').' tertunda',
        ]);

        $footer = implode("\n", [
            $this->escapeMarkdownV2(self::DASHBOARD_HINT),
            '',
            '[Buka dashboard]('.$dashboardUrl.')',
        ]);

        $blocks = [];

        foreach ($notifications as $index => $notification) {
            $blocks[] = implode("\n", $this->reminderBlock($notification, $index));
        }

        $chunks = $this->chunkBlocks($blocks, mb_strlen($header), mb_strlen($footer));

        if (count($chunks) === 1) {
            return [$header."\n\n".$chunks[0]."\n\n".$footer];
        }

        $total = count($chunks);

        return array_map(fn (string $chunk, int $index): string => $header
            ."\n\n".$chunk."\n\n".$footer
            ."\n\n".$this->escapeMarkdownV2('Pesan '.($index + 1).' dari '.$total), $chunks, array_keys($chunks));
    }

    /**
     * Build the lines for a single reminder entry.
     *
     * @param  array<string, mixed>  $notification
     * @return array<int, string>
     */
    private function reminderBlock(array $notification, int $index): array
    {
        $block = ['*Pengingat '.$this->escapeMarkdownV2((string) ($index + 1)).'*'];

        if (! empty($notification['priority'])) {
            $block[] = '*Prioritas*';
        }

        $block[] = '*Tugas:* '.$this->escapeMarkdownV2((string) $notification['task']);
        $block[] = '*Mata Kuliah:* '.$this->escapeMarkdownV2((string) $notification['course_content']);
        $block[] = '*Tenggat:* '.$this->escapeMarkdownV2($this->deadlineText($notification));

        $descriptionLine = $this->descriptionText($notification['description'] ?? null);

        if ($descriptionLine !== null) {
            $block[] = '*Deskripsi:* '.$this->escapeMarkdownV2($descriptionLine);
        }

        return $block;
    }

    /**
     * Group reminder blocks into chunks that stay within Telegram's limit.
     *
     * Header, footer and the optional message-number line are reserved while
     * measuring, so appending them later never pushes a chunk over the limit.
     *
     * @param  array<int, string>  $blocks
     * @return array<int, string>
     */
    private function chunkBlocks(array $blocks, int $headerLength, int $footerLength): array
    {
        $reserved = $headerLength + $footerLength + mb_strlen("\n\n") * 2 + self::NUMBERING_LIMIT;

        $chunks = [];
        $current = [];
        $currentLength = 0;

        foreach ($blocks as $block) {
            $blockLength = mb_strlen($block);
            $added = $blockLength + ($current === [] ? 0 : mb_strlen("\n\n"));

            if ($current !== [] && $reserved + $currentLength + $added > self::MESSAGE_LIMIT) {
                $chunks[] = implode("\n\n", $current);
                $current = [];
                $currentLength = 0;
                $added = $blockLength;
            }

            $current[] = $block;
            $currentLength += $added;
        }

        $chunks[] = implode("\n\n", $current);

        return $chunks;
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
        $text = Carbon::parse((string) $notification['deadline'])->translatedFormat('j F Y');

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
                ->connectTimeout(5)
                ->retry(3, 500, throw: false)
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
