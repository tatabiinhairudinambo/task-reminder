import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/services/notification-service';
import { sendResponse, sendValidationError, route } from '@/lib/api-response';
import { sendResetLinkSchema } from '@/lib/validation';

// POST /api/password/email - PasswordResetController@sendResetLink
//
// Anti-enumeration: the same success message is returned whether or not the
// address exists, so the endpoint cannot be used to probe accounts.

export const POST = route(async (request) => {
  const body = await request.json().catch(() => ({}));
  const parsed = sendResetLinkSchema.safeParse(body);

  if (!parsed.success) {
    return sendValidationError(parsed.error);
  }

  const { email } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    const token = randomBytes(32).toString('hex');

    await prisma.passwordResetToken.upsert({
      where: { email },
      create: { email, token, created_at: new Date() },
      update: { token, created_at: new Date() },
    });

    const base = (process.env.FRONTEND_URL || process.env.APP_URL || '').replace(/\/$/, '');
    const url = `${base}/auth/forgot-password/reset?token=${token}&email=${encodeURIComponent(email)}`;

    await sendEmail({
      to: email,
      subject: 'Reset kata sandi',
      html: `<p>Kami menerima permintaan reset kata sandi.</p><p><a href="${url}">Reset Kata Sandi</a></p><p>Jika Anda tidak meminta ini, abaikan email ini.</p>`,
      text: `Reset kata sandi: ${url}`,
    });
  }

  return sendResponse(
    null,
    'Jika email tersebut terdaftar, kami telah mengirim tautan reset kata sandi.'
  );
});
