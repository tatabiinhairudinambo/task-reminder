import { requireUser } from '@/lib/auth';
import { buildVerificationUrl } from '@/lib/services/auth-service';
import { sendEmail } from '@/lib/services/notification-service';
import { sendResponse, route } from '@/lib/api-response';

// POST /api/email/resend - AuthController@resendVerificationEmail

export const POST = route(async () => {
  const user = await requireUser();

  // Already verified is reported as a 200 success, matching Laravel, because
  // the SPA renders the message directly.
  if (user.email_verified_at) {
    return sendResponse(null, 'Email sudah diverifikasi');
  }

  const url = await buildVerificationUrl(user);

  if (url) {
    await sendEmail({
      to: user.email,
      subject: 'Verifikasi alamat email',
      html: `<p>Halo ${user.name},</p><p>Konfirmasi alamat email Anda:</p><p><a href="${url}">Verifikasi Email</a></p>`,
      text: `Verifikasi email: ${url}`,
    });
  }

  return sendResponse(null, 'Email verifikasi berhasil dikirim');
});
