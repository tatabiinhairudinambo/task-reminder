import { requireVerifiedUser } from '@/lib/auth';
import { filter } from '@/lib/services/course-content-service';
import { sendResponse, route } from '@/lib/api-response';

// GET /api/course-contents/filter?semester=...
//
// Declared before the [id] resource in Laravel so the literal segment was not
// swallowed; Next's file routing makes that distinction structurally.

export const GET = route(async (request) => {
  const user = await requireVerifiedUser();
  const semester = new URL(request.url).searchParams.get('semester') ?? '';
  const data = await filter(user.id, semester);

  return sendResponse(data, 'Data mata kuliah berhasil diambil');
});
