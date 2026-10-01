import { requireVerifiedUser } from '@/lib/auth';
import { getSettings } from '@/lib/services/settings-service';
import { sendResponse, route } from '@/lib/api-response';

// GET /api/settings - SettingsController@index

export const GET = route(async () => {
  const user = await requireVerifiedUser();
  const data = await getSettings(user.id);

  return sendResponse(data, 'Pengaturan berhasil diambil');
});
