import { requireVerifiedUser } from '@/lib/auth';
import { changePassword } from '@/lib/services/user-service';
import { sendResponse, sendValidationError, route } from '@/lib/api-response';
import { changePasswordSchema } from '@/lib/validation';

// PUT /api/settings/password - UserController@changePassword

export const PUT = route(async (request) => {
  const user = await requireVerifiedUser();
  const body = await request.json().catch(() => ({}));
  const parsed = changePasswordSchema.safeParse(body);

  if (!parsed.success) {
    return sendValidationError(parsed.error);
  }

  const { old_password: oldPassword, password } = parsed.data;

  await changePassword(user, oldPassword, password);

  return sendResponse(null, 'Kata sandi berhasil diperbarui');
});
