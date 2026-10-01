import { requireVerifiedUser } from '@/lib/auth';
import { getDashboard } from '@/lib/services/dashboard-service';
import { sendResponse, route } from '@/lib/api-response';

// GET /api/dashboard - DashboardController@index

export const GET = route(async () => {
  const user = await requireVerifiedUser();
  const data = await getDashboard(user.id);

  return sendResponse(data, 'Data dashboard berhasil diambil');
});
