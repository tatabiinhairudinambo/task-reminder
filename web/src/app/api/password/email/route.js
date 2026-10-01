import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/db';
import { sendEmail, emailDocument, emailButtonHtml } from '@/lib/services/notification-service';
import { sendResponse, sendValidationError, route } from '@/lib/api-response';
import { sendResetLinkSchema } from '@/lib/validation';

// POST /api/password/email - PasswordResetController@sendResetLink
//
// Anti-enumeration: the same success message is returned whether or not the
// address exists, so the endpoint cannot be used to probe accounts.

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 12);

export const POST = route(async (request) => {
  const body = await request.json().catch(() => ({}));
  const parsed = sendResetLinkSchema.safeParse(body);

  if (!parsed.success) {
    return sendValidationError(parsed.error);
  }

  const { email } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    // Laravel's PasswordBroker::sendResetLink skips creating (and mailing) a
    // new token when one was issued within the last 60 seconds
    // (DatabaseTokenRepository::$throttle). The response is unchanged.
    const existing = await prisma.passwordResetToken.findUnique({ where: { email } });
    const recentlyCreated =
      existing?.created_at && Date.now() - new Date(existing.created_at).getTime() < 60_000;

    if (!recentlyCreated) {
      // Laravel's DatabaseTokenRepository stores Hash::make($token) and verifies
      // with Hash::check, so the row is interoperable with the Laravel app that
      // shares this database.
      const token = randomBytes(32).toString('hex');
      const hashed = await bcrypt.hash(token, BCRYPT_ROUNDS);

      await prisma.passwordResetToken.upsert({
        where: { email },
        create: { email, token: hashed, created_at: new Date() },
        update: { token: hashed, created_at: new Date() },
      });

      // Subject/link/base mirror ResetPasswordNotification + resources/views/
      // emails/password-reset.blade.php.
      const base = (process.env.FRONTEND_URL || process.env.APP_URL || '').replace(/\/$/, '');
      const url = `${base}/auth/forgot-password/reset?token=${token}&email=${encodeURIComponent(email)}`;

      await sendEmail({
        to: email,
        subject: 'Reset Password',
        html: emailDocument({
          subject: 'Reset Password',
          bodyHtml: `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#0a0f1a;">Hi ${user.name},</p>
<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#0a0f1a;">We received a request to reset your password.</p>
${emailButtonHtml(url, 'Reset Password')}
<p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#64748b;">If you did not request a password reset, you can safely ignore this email.</p>`,
        }),
        text: `Reset Password: ${url}`,
      });
    }
  }

  return sendResponse(
    null,
    'Jika email tersebut terdaftar, kami telah mengirim tautan reset kata sandi.'
  );
});
