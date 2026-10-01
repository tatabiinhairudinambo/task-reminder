import { register, buildVerificationUrl } from '@/lib/services/auth-service';
import { setSessionCookie } from '@/lib/auth';
import { sendEmail } from '@/lib/services/notification-service';
import { sendResponse, sendValidationError, route } from '@/lib/api-response';
import { registerSchema } from '@/lib/validation';

// POST /api/auth/register
//
// Laravel fired the `Registered` event (which queued the verification mail);
// here the mail is sent inline because there is no queue worker on Vercel.

export const POST = route(async (request) => {
  const body = await request.json().catch(() => ({}));
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return sendValidationError(parsed.error);
  }

  const data = await register(parsed.data);

  await setSessionCookie(BigInt(data.user.id), false);

  const { prisma } = await import('@/lib/db');
  const user = await prisma.user.findUnique({ where: { id: BigInt(data.user.id) } });
  const url = await buildVerificationUrl(user);

  if (url) {
    await sendEmail({
      to: user.email,
      subject: 'Verifikasi alamat email',
      html: `<p>Halo ${user.name},</p><p>Konfirmasi alamat email Anda dengan menekan tautan berikut:</p><p><a href="${url}">Verifikasi Email</a></p>`,
      text: `Verifikasi email: ${url}`,
    });
  }

  return sendResponse(data, 'Pendaftaran berhasil', 201);
});
