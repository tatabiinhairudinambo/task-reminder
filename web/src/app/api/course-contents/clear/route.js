import { requireVerifiedUser } from '@/lib/auth';
import { clearSemester } from '@/lib/services/course-content-service';
import { sendResponse, sendValidationError, route } from '@/lib/api-response';
import { clearSemesterSchema } from '@/lib/validation';

// POST /api/course-contents/clear - CourseContentController@clear

export const POST = route(async (request) => {
  const user = await requireVerifiedUser();
  const body = await request.json().catch(() => ({}));
  const parsed = clearSemesterSchema.safeParse(body);

  if (!parsed.success) {
    return sendValidationError(parsed.error);
  }

  const result = await clearSemester(user.id, parsed.data.semester);

  const message =
    `${result.deleted_courses} mata kuliah dan ${result.deleted_tasks} tugas ` +
    `dihapus dari ${result.semester}`;

  return sendResponse(result, message);
});
