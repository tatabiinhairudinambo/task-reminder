import { requireUser } from '@/lib/auth';
import { sendResponse, route } from '@/lib/api-response';

// GET /api/auth/check/token - AuthController@checkToken

export const GET = route(async () => {
  await requireUser();

  return sendResponse({ valid: true }, 'Token valid');
});
