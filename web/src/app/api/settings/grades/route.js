import { requireVerifiedUser } from '@/lib/auth';
import { getAll, create } from '@/lib/services/grade-service';
import { sendResponse, sendValidationError, route } from '@/lib/api-response';
import { storeGradeSchema } from '@/lib/validation';

// GET  /api/settings/grades - GradeController@index
// POST /api/settings/grades - GradeController@store

export const GET = route(async () => {
  const user = await requireVerifiedUser();
  const data = await getAll(user.id);

  return sendResponse(data, 'Data nilai berhasil diambil');
});

export const POST = route(async (request) => {
  const user = await requireVerifiedUser();
  const body = await request.json().catch(() => ({}));
  const parsed = storeGradeSchema.safeParse(body);

  if (!parsed.success) {
    return sendValidationError(parsed.error);
  }

  const grade = await create(user.id, parsed.data);

  return sendResponse(grade, 'Nilai berhasil dibuat', 201);
});
