import { requireVerifiedUser } from '@/lib/auth';
import { calculateGpa } from '@/lib/services/assessment-service';
import { sendResponse, route } from '@/lib/api-response';

// GET /api/assessments/calculate?semester=...

export const GET = route(async (request) => {
  const user = await requireVerifiedUser();
  const semester = new URL(request.url).searchParams.get('semester');
  const data = await calculateGpa(user.id, semester);

  return sendResponse(data, 'Mata kuliah, IPK semester, dan IPK kumulatif berhasil diambil');
});
