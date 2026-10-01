import { requireVerifiedUser } from '@/lib/auth';
import { update, remove } from '@/lib/services/course-content-service';
import { sendResponse, sendValidationError, route } from '@/lib/api-response';
import { updateCourseContentSchema } from '@/lib/validation';

// PUT|PATCH /api/course-contents/[id] - CourseContentController@update
// DELETE    /api/course-contents/[id] - CourseContentController@destroy

export const PUT = route(async (request, { params }) => {
  const user = await requireVerifiedUser();
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = updateCourseContentSchema.safeParse(body);

  if (!parsed.success) {
    return sendValidationError(parsed.error);
  }

  const content = await update(user.id, id, parsed.data);

  return sendResponse(content, 'Mata kuliah berhasil diperbarui');
});

export const PATCH = PUT;

export const DELETE = route(async (request, { params }) => {
  const user = await requireVerifiedUser();
  const { id } = await params;

  await remove(user.id, id);

  return sendResponse(null, 'Mata kuliah berhasil dihapus');
});
