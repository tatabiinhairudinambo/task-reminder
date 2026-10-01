import { requireVerifiedUser } from '@/lib/auth';
import { updateDeadlineNotification } from '@/lib/services/settings-service';
import { sendResponse, sendValidationError, route } from '@/lib/api-response';
import { updateDeadlineNotificationSchema } from '@/lib/validation';

// PUT /api/settings/deadline-notification

export const PUT = route(async (request) => {
  const user = await requireVerifiedUser();
  const body = await request.json().catch(() => ({}));
  const parsed = updateDeadlineNotificationSchema.safeParse(body);

  if (!parsed.success) {
    return sendValidationError(parsed.error);
  }

  const setting = await updateDeadlineNotification(
    user.id,
    parsed.data.deadline_notification
  );

  return sendResponse(setting, 'Notifikasi tenggat berhasil diperbarui');
});
