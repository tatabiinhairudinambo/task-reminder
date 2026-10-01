import { login } from '@/lib/services/auth-service';
import { setSessionCookie } from '@/lib/auth';
import { sendResponse, sendValidationError, route } from '@/lib/api-response';
import { loginSchema } from '@/lib/validation';

// POST /api/auth/login
//
// Replaces the Sanctum bearer token with an httpOnly cookie. The JSON body
// still carries a `token` field because the SPA mirrors it into localStorage
// for its own UI state; the cookie is the actual credential.

export const POST = route(async (request) => {
  const body = await request.json().catch(() => ({}));
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return sendValidationError(parsed.error);
  }

  const { email, password, remember_me: rememberMe } = parsed.data;
  const data = await login(email, password, rememberMe);

  await setSessionCookie(BigInt(data.user.id), Boolean(rememberMe));

  return sendResponse(data, 'Berhasil masuk');
});
