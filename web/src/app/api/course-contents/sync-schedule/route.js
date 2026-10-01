import { requireVerifiedUser } from '@/lib/auth';
import { syncScheduleFromSiakang } from '@/lib/services/course-content-service';
import { sendResponse, sendValidationError, route } from '@/lib/api-response';
import { syncScheduleSchema } from '@/lib/validation';

// POST /api/course-contents/sync-schedule - CourseContentController@syncSchedule
//
// Requires the Python bridge. On Vercel this answers with an actionable error
// unless SIAKANG_BRIDGE_URL points at a host running server/siakang-sync.
//
// The bridge allows 120s for a schedule scrape; Vercel's default function
// timeout is shorter, so it is raised here (Pro allows 300s; on Hobby the plan
// cap still applies and the request would be cut at 60s).
export const maxDuration = 300;

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
