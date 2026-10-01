import { requireVerifiedUser } from '@/lib/auth';
import { siakangCredentialsOf } from '@/lib/services/settings-service';
import { verify } from '@/lib/services/siakang-client';
import { sendResponse, sendError, route } from '@/lib/api-response';

// POST /api/settings/siakang-credentials/test
//
// Read-only re-verification of the stored credentials. The password is never
// echoed back; only the email is returned.

export const POST = route(async () => {
  const user = await requireVerifiedUser();

  const credentials = await siakangCredentialsOf(user.id);

  if (!credentials) {
    return sendError('Kredensial Siakang belum diatur. Tambahkan di Pengaturan.', 422);
  }

  const response = await verify(credentials.email, credentials.password);

  if ((response.code ?? 0) !== 200) {
    return sendError(
      response.message ?? 'Login failed — check email/password',
      Number(response.code) || 401
    );
  }

  return sendResponse({ email: credentials.email }, 'Koneksi Siakang berhasil');
});
