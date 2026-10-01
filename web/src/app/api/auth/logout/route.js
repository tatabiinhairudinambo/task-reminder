import { requireUser, clearSessionCookie } from '@/lib/auth';
import { sendResponse, route } from '@/lib/api-response';

// POST /api/auth/logout - AuthController@logout
//
// Laravel put this behind auth:sanctum + verified, so an unauthenticated call
// is 401 and never reaches the controller.

export const POST = route(async () => {
  await requireUser();
  await clearSessionCookie();

  return sendResponse(null, 'Berhasil keluar');
});
