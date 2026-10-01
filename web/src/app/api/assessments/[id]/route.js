import { requireVerifiedUser } from '@/lib/auth';
import { sendResponse, sendValidationError, route } from '@/lib/api-response';
import { updateAssessmentSchema } from '@/lib/validation';

// PATCH /api/assessments/[id] - AssessmentController@update
//
// Sending `score: null` explicitly clears the score, matching Laravel's
// `nullable` rule.

export const PATCH = route(async (request, { params }) => {
  const user = await requireVerifiedUser();
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = updateAssessmentSchema.safeParse(body);

  if (!parsed.success) {
    return sendValidationError(parsed.error);
  }

  const { updateScore } = await import('@/lib/services/assessment-service');
  const content = await updateScore(user.id, id, parsed.data.score ?? null);

  return sendResponse(content, 'Skor berhasil diperbarui');
});
