import { requireVerifiedUser } from '@/lib/auth';
import { sendTestNotification } from '@/lib/services/notification-service';
import { sendResponse, route } from '@/lib/api-response';
import { ApiError } from '@/lib/api-response';

// POST /api/settings/test-notification - SettingsController@testNotification
//
// Synchronous (unlike the queued task notifications) so the Settings page can
// report a delivery failure straight away. The SPA shows 502 as a toast.

export const POST = route(async () => {
  const user = await requireVerifiedUser();

  try {
    const { channels } = await sendTestNotification(user.id);
    const label = channels.map((c) => c.charAt(0).toUpperCase() + c.slice(1)).join(' dan ');

    return sendResponse({ channels }, `Notifikasi uji terkirim ke ${label}`);
  } catch (error) {
    if (error?.code) {
      throw new ApiError(error.message, error.code);
    }
    throw error;
  }
});
