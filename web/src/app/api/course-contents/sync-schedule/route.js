import { requireVerifiedUser } from '@/lib/auth';
import { syncScheduleFromSiakang } from '@/lib/services/course-content-service';
import { sendResponse, sendValidationError, route } from '@/lib/api-response';
import { syncScheduleSchema } from '@/lib/validation';

// POST /api/course-contents/sync-schedule - CourseContentController@syncSchedule
//
// Requires the Python bridge. On Vercel this answers with an actionable error
// unless SIAKANG_BRIDGE_URL points at a host running server/siakang-sync.

export const POST = route(async (request) => {
  const user = await requireVerifiedUser();
  const body = await request.json().catch(() => ({}));
  const parsed = syncScheduleSchema.safeParse(body);

  if (!parsed.success) {
    return sendValidationError(parsed.error);
  }

  const result = await syncScheduleFromSiakang(
    user.id,
    parsed.data.semester,
    parsed.data.source_semester ?? null
  );

  const message = `${result.inserted} jadwal diimpor, ${result.skipped.length} dilewati`;

  return sendResponse(result, message);
});
