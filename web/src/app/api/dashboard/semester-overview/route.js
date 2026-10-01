import { requireVerifiedUser } from '@/lib/auth';
import { getSemesterOverview } from '@/lib/services/dashboard-service';
import { sendResponse, route } from '@/lib/api-response';

// GET /api/dashboard/semester-overview

export const GET = route(async () => {
  const user = await requireVerifiedUser();
  const data = await getSemesterOverview(user.id);

  return sendResponse(data, 'Ringkasan semester berhasil diambil');
});
