import { requireVerifiedUser } from '@/lib/auth';
import { updateProfile } from '@/lib/services/user-service';
import { buildVerificationUrl } from '@/lib/services/auth-service';
import { sendEmail } from '@/lib/services/notification-service';
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
        issues: [{ path: ['email'], message: 'Kolom email sudah digunakan.' }],
      });
    }
  }

  const { user: updated } = await updateProfile(user, { name, email });

  if (email !== user.email) {
    const url = await buildVerificationUrl(updated);

    if (url) {
      await sendEmail({
        to: updated.email,
        subject: 'Verifikasi alamat email',
        html: `<p>Halo ${updated.name},</p><p>Konfirmasi alamat email baru Anda:</p><p><a href="${url}">Verifikasi Email</a></p>`,
        text: `Verifikasi email: ${url}`,
      });
    }
  }

  return sendResponse(serializeUser(updated), 'Profil berhasil diperbarui');
});
