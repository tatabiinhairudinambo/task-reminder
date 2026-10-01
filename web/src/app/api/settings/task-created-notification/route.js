import { requireVerifiedUser } from '@/lib/auth';
import { toggleTaskCreatedNotification } from '@/lib/services/settings-service';
import { sendResponse, route } from '@/lib/api-response';

// PATCH /api/settings/task-created-notification (no body; flips the flag)

export const PATCH = route(async () => {
  const user = await requireVerifiedUser();
  const setting = await toggleTaskCreatedNotification(user.id);

  return sendResponse(setting, 'Notifikasi tugas dibuat berhasil diperbarui');
});
