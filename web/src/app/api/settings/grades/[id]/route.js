import { requireVerifiedUser } from '@/lib/auth';
import { update, remove } from '@/lib/services/grade-service';
import { sendResponse, sendValidationError, route } from '@/lib/api-response';
import { updateGradeSchema } from '@/lib/validation';

// PUT|PATCH /api/settings/grades/[id] - GradeController@update
// DELETE    /api/settings/grades/[id] - GradeController@destroy

export const PUT = route(async (request, { params }) => {
  const user = await requireVerifiedUser();
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = updateGradeSchema.safeParse(body);

  if (!parsed.success) {
    return sendValidationError(parsed.error);
  }

  const grade = await update(user.id, id, parsed.data);

  return sendResponse(grade, 'Nilai berhasil diperbarui');
});

export const PATCH = PUT;

export const DELETE = route(async (request, { params }) => {
  const user = await requireVerifiedUser();
  const { id } = await params;

  await remove(user.id, id);

  return sendResponse(null, 'Nilai berhasil dihapus');
});
