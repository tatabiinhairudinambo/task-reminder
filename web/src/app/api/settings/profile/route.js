import { requireVerifiedUser } from '@/lib/auth';
import { updateProfile } from '@/lib/services/user-service';
import { buildVerificationUrl } from '@/lib/services/auth-service';
import { sendEmail, emailDocument, emailButtonHtml } from '@/lib/services/notification-service';
import { sendResponse, sendValidationError, route } from '@/lib/api-response';
import { updateProfileSchema } from '@/lib/validation';
import { prisma } from '@/lib/db';
import { serializeUser } from '@/lib/serialize';

// PUT /api/settings/profile - UserController@updateProfile
//
// Changing the email clears `email_verified_at` and resends verification;
// a same-email update keeps the verified flag.

export const PUT = route(async (request) => {
  const user = await requireVerifiedUser();
  const body = await request.json().catch(() => ({}));
  const parsed = updateProfileSchema.safeParse(body);

  if (!parsed.success) {
    return sendValidationError(parsed.error);
  }

  const { name, email } = parsed.data;

  // Laravel's unique rule ignored the current user, so only a *different*
  // account with that address is a conflict.
  if (email !== user.email) {
    const taken = await prisma.user.findUnique({ where: { email } });

    if (taken) {
      return sendValidationError({
        issues: [{ path: ['email'], message: 'The email has already been taken.' }],
      });
    }
  }

  const { user: updated } = await updateProfile(user, { name, email });

  if (email !== user.email) {
    const url = await buildVerificationUrl(updated);

    if (url) {
      await sendEmail({
        to: updated.email,
        subject: 'Verify Email Address',
        html: emailDocument({
          subject: 'Verify Email Address',
          bodyHtml: `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#0a0f1a;">Hi ${updated.name},</p>
<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#0a0f1a;">Thank you for registering! Please verify your email address by clicking the button below.</p>
${emailButtonHtml(url, 'Verify Email Address')}
<p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#64748b;">If you did not create an account, you can safely ignore this email.</p>`,
        }),
        text: `Verify Email Address: ${url}`,
      });
    }
  }

  return sendResponse(serializeUser(updated), 'Profil berhasil diperbarui');
});
