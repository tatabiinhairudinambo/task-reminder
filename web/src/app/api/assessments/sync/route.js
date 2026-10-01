import { requireVerifiedUser } from '@/lib/auth';
import { syncScoresFromSiakang } from '@/lib/services/assessment-service';
import { sendResponse, sendError, sendValidationError, route } from '@/lib/api-response';
import { syncAssessmentSchema } from '@/lib/validation';

// POST /api/assessments/sync - AssessmentController@sync
//
// The Siakang bridge can take up to 60s; raise the function timeout.
export const maxDuration = 120;

export const POST = route(async (request) => {
  const user = await requireVerifiedUser();
  const body = await request.json().catch(() => ({}));
  const parsed = syncAssessmentSchema.safeParse(body);

  if (!parsed.success) {
    return sendValidationError(parsed.error);
  }

  const result = await syncScoresFromSiakang(
    user.id,
    parsed.data.semester ?? null,
    parsed.data.source_semester ?? null
  );

  const updated = result.updated;
  const unchanged = result.unchanged;
  const noMatchCount = result.no_match.length;

  const parts = [];

  if (updated > 0) parts.push(`${updated} skor diperbarui`);
  if (unchanged > 0) parts.push(`${unchanged} sudah terbaru`);

  let message = parts.length === 0 ? 'Tidak ada skor yang cocok' : parts.join(', ');

  if (noMatchCount > 0) {
    message += ` — ${noMatchCount} mata kuliah tidak ditemukan di ${result.semester_label}`;
  }

  // Nothing updated and nothing was already current -> sendError (data: null),
  // matching AssessmentController::sync.
  if (updated === 0 && unchanged === 0) {
    return sendError(message, 422);
  }

  return sendResponse(result, message);
});
