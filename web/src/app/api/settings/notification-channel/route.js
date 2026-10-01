import { requireVerifiedUser } from '@/lib/auth';
import { updateNotificationChannel } from '@/lib/services/settings-service';
import { sendResponse, sendValidationError, route } from '@/lib/api-response';
import { updateNotificationChannelSchema } from '@/lib/validation';

// PUT /api/settings/notification-channel

export const PUT = route(async (request) => {
  const user = await requireVerifiedUser();
  const body = await request.json().catch(() => ({}));
  const parsed = updateNotificationChannelSchema.safeParse(body);

  if (!parsed.success) {
    return sendValidationError(parsed.error);
  }

  const setting = await updateNotificationChannel(user.id, parsed.data.notification_channel);

  return sendResponse(setting, 'Channel notifikasi berhasil diperbarui');
});
