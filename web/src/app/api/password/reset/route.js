import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { sendResponse, sendError, sendValidationError, route } from '@/lib/api-response';
import { resetPasswordSchema } from '@/lib/validation';

// POST /api/password/reset - PasswordResetController@resetPassword

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 12);

export const POST = route(async (request) => {
  const body = await request.json().catch(() => ({}));
  const parsed = resetPasswordSchema.safeParse(body);

  if (!parsed.success) {
    return sendValidationError(parsed.error);
  }

  const { email, token, password } = parsed.data;

  const record = await prisma.passwordResetToken.findUnique({ where: { email } });

  // Same message for a missing row, a wrong token, or an expired one, so the
  // endpoint does not leak which part failed.
  const invalid = () => {
    return sendError(
      'Tidak dapat mereset kata sandi. Token mungkin tidak valid atau sudah kedaluwarsa.',
      400
    );
  };

  if (!record || record.token !== token) {
    return invalid();
  }

  // Laravel's default reset token lifetime is 60 minutes.
  const createdAt = record.created_at ? new Date(record.created_at).getTime() : 0;
  if (Date.now() - createdAt > 60 * 60 * 1000) {
    return invalid();
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    return invalid();
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: await bcrypt.hash(password, BCRYPT_ROUNDS),
      updated_at: new Date(),
    },
  });

  await prisma.passwordResetToken.delete({ where: { email } }).catch(() => {});

  return sendResponse(null, 'Kata sandi berhasil direset.');
});
