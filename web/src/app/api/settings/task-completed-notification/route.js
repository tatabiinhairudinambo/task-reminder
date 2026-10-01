import { requireVerifiedUser } from '@/lib/auth';
import { toggleTaskCompletedNotification } from '@/lib/services/settings-service';
import { sendResponse, route } from '@/lib/api-response';

// PATCH /api/settings/task-completed-notification

export const PATCH = route(async () => {
  const user = await requireVerifiedUser();
  const setting = await toggleTaskCompletedNotification(user.id);

  return sendResponse(setting, 'Notifikasi tugas selesai berhasil diperbarui');
});
