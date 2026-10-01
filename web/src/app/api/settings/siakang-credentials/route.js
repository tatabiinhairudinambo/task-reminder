import { requireVerifiedUser } from '@/lib/auth';
import {
  saveSiakangCredentials,
  clearSiakangCredentials,
} from '@/lib/services/settings-service';
import { verify } from '@/lib/services/siakang-client';
import { sendResponse, sendValidationError, route } from '@/lib/api-response';
import { storeSiakangCredentialsSchema } from '@/lib/validation';

// PUT    /api/settings/siakang-credentials
// DELETE /api/settings/siakang-credentials
//
// The credentials are verified against Siakang BEFORE they are persisted, so
// a wrong password is rejected instead of stored.

export const PUT = route(async (request) => {
  const user = await requireVerifiedUser();
  const body = await request.json().catch(() => ({}));
  const parsed = storeSiakangCredentialsSchema.safeParse(body);

  if (!parsed.success) {
    return sendValidationError(parsed.error);
  }

  const { siakang_email: email, siakang_password: password } = parsed.data;

  const response = await verify(email.trim(), password);

  if ((response.code ?? 0) !== 200) {
    const { sendError } = await import('@/lib/api-response');

    return sendError(
      response.message ?? 'Login failed — check email/password',
      Number(response.code) || 401
    );
  }

  const data = await saveSiakangCredentials(user.id, email, password);

  return sendResponse(data, 'Kredensial Siakang berhasil disimpan');
});

export const DELETE = route(async () => {
  const user = await requireVerifiedUser();
  const data = await clearSiakangCredentials(user.id);

  return sendResponse(data, 'Kredensial Siakang berhasil dihapus');
});
