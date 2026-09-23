<?php

namespace App\Notifications\Channels;

use App\Services\TelegramService;
use Illuminate\Notifications\Notification;

class TelegramChannel
{
    public function __construct(
        private readonly TelegramService $telegram
    ) {}

    /**
     * Send the given notification.
     *
     * A notification may return a single message or several when the content
     * exceeds Telegram's 4096-character limit; each is delivered in order.
     */
    public function send(object $notifiable, Notification $notification): void
    {
        if (! method_exists($notification, 'toTelegram')) {
            return;
        }

        $chatId = $notifiable->routeNotificationFor('telegram', $notification);

        if (! is_string($chatId) || trim($chatId) === '') {
            return;
        }

        $messages = $notification->toTelegram($notifiable);

        if (is_string($messages)) {
            $messages = [$messages];
        }

        if (! is_array($messages)) {
            return;
        }

        foreach ($messages as $message) {
            if (! is_string($message) || $message === '') {
                continue;
            }

            $this->telegram->sendMessage($chatId, $message);
        }
    }
}
