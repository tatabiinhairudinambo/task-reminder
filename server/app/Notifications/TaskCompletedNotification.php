<?php

namespace App\Notifications;

use App\Notifications\Concerns\ResolvesNotificationChannels;
use App\Services\TelegramService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class TaskCompletedNotification extends Notification implements ShouldQueue
{
    use Queueable, ResolvesNotificationChannels;

    public $courseContent;

    public $task;

    public $description;

    /**
     * Create a new notification instance.
     *
     * Scalars are stored instead of the Task model: this notification is
     * queued, and Laravel re-fetches queued models when the worker runs. If
     * the task is deleted first, an Eloquent model here would make the job
     * fail with a ModelNotFoundException and the message would never send.
     */
    public function __construct(string $courseContent, string $task, ?string $description = null)
    {
        $this->courseContent = $courseContent;
        $this->task = $task;
        $this->description = $description;
    }

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return self::channelsFor($notifiable);
    }

    /**
     * Get the Telegram representation of the notification.
     */
    public function toTelegram(object $notifiable): string
    {
        return app(TelegramService::class)->buildTaskCompletedMessage(
            $this->courseContent,
            $this->task,
            $this->description
        );
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Notifikasi Tugas Selesai')
            ->view('emails.task-completed', [
                'subject' => 'Notifikasi Tugas Selesai',
                'userName' => $notifiable->name,
                'courseContent' => $this->courseContent,
                'task' => $this->task,
                'dashboardUrl' => config('app.frontend_url').'/dashboard',
            ]);
    }

    /**
     * Get the array representation of the notification.
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            //
        ];
    }
}
