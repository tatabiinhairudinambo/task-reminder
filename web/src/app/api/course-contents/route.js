import { requireVerifiedUser } from '@/lib/auth';
import { create } from '@/lib/services/course-content-service';
import { sendResponse, sendValidationError, route } from '@/lib/api-response';
import { storeCourseContentSchema } from '@/lib/validation';

// POST /api/course-contents - CourseContentController@store

export const POST = route(async (request) => {
  const user = await requireVerifiedUser();
  const body = await request.json().catch(() => ({}));
  const parsed = storeCourseContentSchema.safeParse(body);

  if (!parsed.success) {
    return sendValidationError(parsed.error);
  }

  const content = await create(user.id, parsed.data);

  return sendResponse(content, 'Mata kuliah berhasil dibuat', 201);
});
