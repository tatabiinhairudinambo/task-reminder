import { clearSessionCookie } from '@/lib/auth';
import { sendResponse, route } from '@/lib/api-response';

// POST /api/auth/logout - AuthController@logout

export const POST = route(async () => {
  await clearSessionCookie();

  return sendResponse(null, 'Berhasil keluar');
});
