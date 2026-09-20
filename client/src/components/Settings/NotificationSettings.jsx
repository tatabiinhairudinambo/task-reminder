import { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const DEADLINES = ['7 hari lagi', '5 hari lagi', '3 hari lagi', '1 hari lagi'];
const CHANNEL_OPTIONS = [
    { value: 'email', label: 'Email' },
    { value: 'telegram', label: 'Telegram' },
    { value: 'both', label: 'Keduanya' },
];

export const NotificationSettings = ({
    isLoading,
    isMutating,
    notify,
    notificationChannel,
    telegramChatId,
    taskCreated,
    taskCompleted,
    onNotifyChange,
    onNotificationChannelChange,
    onTelegramChatIdSave,
    onTestNotification,
    onTaskCreatedToggle,
    onTaskCompletedToggle,
}) => {
    const [chatIdInput, setChatIdInput] = useState('');
    const [chatIdError, setChatIdError] = useState('');
    const needsTelegramChatId = notificationChannel === 'telegram' || notificationChannel === 'both';
    const isTestDisabled = isMutating || (needsTelegramChatId && telegramChatId?.trim() === '');

    useEffect(() => {
        setChatIdInput(telegramChatId || '');
        setChatIdError('');
    }, [telegramChatId]);

    const handleChannelSave = async () => {
        if (needsTelegramChatId && chatIdInput.trim() === '') {
            setChatIdError('Telegram Chat ID wajib diisi.');
            return;
        }
        setChatIdError('');

        // Save whenever the input differs from what is stored, even while
        // the channel is still email (the normal first-time flow).
        if (chatIdInput.trim() !== (telegramChatId || '')) {
            const result = await onTelegramChatIdSave(chatIdInput);
            if (result && result.success === false) {
                return;
            }
        }

        await onNotificationChannelChange(notificationChannel);
    };

    const handleChannelSelect = async (value) => {
        // Flush a pending typed chat ID before switching, otherwise the
        // server rejects telegram/both with "Please set Telegram chat ID first".
        if ((value === 'telegram' || value === 'both') && chatIdInput.trim() === '') {
            setChatIdError('Atur Telegram Chat ID terlebih dahulu, lalu ganti channel.');
            return;
        }
        setChatIdError('');

        if (chatIdInput.trim() !== '' && chatIdInput.trim() !== (telegramChatId || '')) {
            const result = await onTelegramChatIdSave(chatIdInput);
            if (result && result.success === false) {
                return;
            }
        }

        await onNotificationChannelChange(value);
    };

    return (
        <Card className="my-4">
            <CardContent className="p-6">
                <div className="flex flex-col gap-3">
                    <div>
                        <p className="text-lg">Channel Notifikasi</p>
                        <span className="text-muted-foreground">
                            Pilih tujuan pengiriman pengingat.
                        </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 sm:max-w-sm">
                        {CHANNEL_OPTIONS.map((option) => (
                            <Button
                                key={option.value}
                                type="button"
                                variant={isLoading ? 'outline' : notificationChannel === option.value ? 'default' : 'outline'}
                                onClick={() => handleChannelSelect(option.value)}
                                disabled={isMutating || isLoading}
                            >
                                {option.label}
                            </Button>
                        ))}
                    </div>

                    <div className="space-y-2">
                        <div className="flex flex-row gap-2">
                            {isLoading ? (
                                <Skeleton className="h-10 w-full" />
                            ) : (
                                <Input
                                    placeholder="Telegram Chat ID"
                                    value={chatIdInput}
                                    onChange={(event) => {
                                        setChatIdInput(event.target.value);
                                        if (chatIdError) setChatIdError('');
                                    }}
                                    disabled={isMutating}
                                    className="min-w-0 flex-1"
                                />
                            )}
                            <Button
                                type="button"
                                onClick={() => handleChannelSave()}
                                disabled={isMutating || isLoading}
                            >
                                Simpan
                            </Button>
                        </div>
                        {chatIdError ? (
                            <p className="text-sm text-destructive">{chatIdError}</p>
                        ) : needsTelegramChatId && (telegramChatId?.trim() === '') ? (
                            <p className="text-sm text-muted-foreground">
                                Atur Telegram Chat ID terlebih dahulu, lalu ganti channel ke Telegram atau Keduanya.
                            </p>
                        ) : null}
                    </div>

                    <div>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onTestNotification}
                            disabled={isTestDisabled}
                            title="Mengirim pesan uji ke channel yang sedang aktif."
                        >
                            <Send className="mr-2 h-4 w-4" /> Kirim Notifikasi Uji
                        </Button>
                    </div>
                </div>

                <Separator className="my-4" />

                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-lg">Notifikasi Tenggat</p>
                        <span className="text-muted-foreground">
                            Tampilkan notifikasi saat tugas mendekati tenggat.
                        </span>
                    </div>

                    {isLoading ? (
                        <Skeleton className="h-10 w-[170px]" />
                    ) : (
                        <Select value={notify} onValueChange={onNotifyChange}>
                            <SelectTrigger className="w-[170px]" disabled={isMutating}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {DEADLINES.map((deadline) => (
                                    <SelectItem key={deadline} value={deadline}>
                                        {deadline}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>

                <Separator className="my-4" />

                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-lg">Notifikasi Tugas Dibuat</p>
                        <span className="text-muted-foreground">
                            Tampilkan notifikasi saat tugas berhasil dibuat.
                        </span>
                    </div>
                    <div className="w-[108px] text-center">
                        {isLoading ? (
                            <Skeleton className="mx-auto h-6 w-11 rounded-full" />
                        ) : (
                            <Switch checked={taskCreated === 1} onCheckedChange={onTaskCreatedToggle} disabled={isMutating} />
                        )}
                    </div>
                </div>

                <Separator className="my-4" />

                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-lg">Notifikasi Tugas Selesai</p>
                        <span className="text-muted-foreground">
                            Tampilkan notifikasi saat tugas berhasil diselesaikan.
                        </span>
                    </div>
                    <div className="w-[108px] text-center">
                        {isLoading ? (
                            <Skeleton className="mx-auto h-6 w-11 rounded-full" />
                        ) : (
                            <Switch checked={taskCompleted === 1} onCheckedChange={onTaskCompletedToggle} disabled={isMutating} />
                        )}
                    </div>
                </div>

            </CardContent>
        </Card>
    );
};
