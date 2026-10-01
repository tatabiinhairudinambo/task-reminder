import { requireUser } from '@/lib/auth';
import { verifyEmail } from '@/lib/services/auth-service';
import { hasValidSignature } from '@/lib/signed-url';
import { sendResponse } from '@/lib/api-response';

// GET /api/email/verify/[id]/[hash]
//
// Replaces Laravel's `signed` middleware + AuthController@verifyEmail. The
// route sat behind auth:sanctum, so the same check runs first. The envelope is
// { code, message, data: null } with Laravel's exact messages and statuses so
// the SPA's VerifiedEmail page behaves as before:
//
//   unauthenticated       -> 401 {"message":"Unauthenticated."}
//   bad/expired signature -> 400 "Tautan verifikasi tidak valid atau sudah kedaluwarsa"
//   fresh verification    -> 200 "Email berhasil diverifikasi"
//   already verified      -> 202 "Email sudah diverifikasi"
//   unknown user          -> 202 "Pengguna tidak ditemukan"

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  await requireUser();

  const { id, hash } = await params;
  const { searchParams } = new URL(request.url);
  const pathname = `/api/email/verify/${id}/${hash}`;

  if (!hasValidSignature(pathname, searchParams)) {
    return sendResponse(null, 'Tautan verifikasi tidak valid atau sudah kedaluwarsa', 400);
  }

  try {
    await verifyEmail(BigInt(id));

    return sendResponse(null, 'Email berhasil diverifikasi');
  } catch (error) {
    return sendResponse(null, error.message, Number(error?.code) || 202);
  }
}
