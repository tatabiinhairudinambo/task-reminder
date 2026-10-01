import { requireVerifiedUser } from '@/lib/auth';
import { getChart } from '@/lib/services/dashboard-service';
import { sendResponse, route } from '@/lib/api-response';

// GET /api/dashboard/chart?semester=...

export const GET = route(async (request) => {
  const user = await requireVerifiedUser();
  const semester = new URL(request.url).searchParams.get('semester') ?? '';
  const data = await getChart(user.id, semester);

  return sendResponse(data, 'Data grafik berhasil diambil');
});
