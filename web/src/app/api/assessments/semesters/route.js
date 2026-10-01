import { requireVerifiedUser } from '@/lib/auth';
import { siakangCredentialsOf } from '@/lib/services/settings-service';
import { listSemesters } from '@/lib/services/siakang-client';
import { sendResponse, sendError, route } from '@/lib/api-response';

// GET /api/assessments/semesters - AssessmentController@semesters
//
// The Siakang bridge can take up to 60s; raise the function timeout.
export const maxDuration = 120;

export const GET = route(async () => {
  const user = await requireVerifiedUser();

  const credentials = await siakangCredentialsOf(user.id);

  if (!credentials) {
    return sendError('Kredensial Siakang belum diatur. Tambahkan di Pengaturan.', 422);
  }

  const response = await listSemesters(credentials.email, credentials.password);

  if ((response.code ?? 0) !== 200) {
    return sendError(
      response.message ?? 'Gagal mengambil semester dari Siakang.',
      Number(response.code) || 502
    );
  }

  return sendResponse(response.data ?? [], 'Semester Siakang berhasil diambil');
});
