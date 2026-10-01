import { requireUser } from '@/lib/auth';
import { checkEmailVerified } from '@/lib/services/auth-service';
import { sendResponse, route } from '@/lib/api-response';

// GET /api/auth/check/email - AuthController@checkEmail

export const GET = route(async () => {
  const user = await requireUser();
  const { verified } = checkEmailVerified(user);

  return sendResponse(
    { verified },
    verified ? 'Email sudah diverifikasi' : 'Email belum diverifikasi'
  );
});
