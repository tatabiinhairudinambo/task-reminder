import { requireVerifiedUser } from '@/lib/auth';
import { syncScoresFromSiakang } from '@/lib/services/assessment-service';
import { sendResponse, sendValidationError, route } from '@/lib/api-response';
import { syncAssessmentSchema } from '@/lib/validation';

// POST /api/assessments/sync - AssessmentController@sync

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

  if (result.updated === 0 && result.unchanged === 0) {
    const suffix = result.no_match.length > 0 ? ` — ${result.no_match.length} mata kuliah tidak ditemukan` : '';

    return sendResponse(result, `Tidak ada skor yang cocok${suffix}`, 422);
  }

  let message = `${result.updated} skor diperbarui, ${result.unchanged} tidak berubah`;

  if (result.no_match.length > 0 && result.semester_label) {
    message += ` — ${result.no_match.length} mata kuliah tidak ditemukan di ${result.semester_label}`;
  }

  return sendResponse(result, message);
});
