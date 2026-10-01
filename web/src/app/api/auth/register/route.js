import { register, buildVerificationUrl } from '@/lib/services/auth-service';
import { setSessionCookie } from '@/lib/auth';
import { sendEmail, emailDocument, emailButtonHtml } from '@/lib/services/notification-service';
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
      subject: 'Verify Email Address',
      html: emailDocument({
        subject: 'Verify Email Address',
        bodyHtml: `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#0a0f1a;">Hi ${user.name},</p>
<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#0a0f1a;">Thank you for registering! Please verify your email address by clicking the button below.</p>
${emailButtonHtml(url, 'Verify Email Address')}
<p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#64748b;">If you did not create an account, you can safely ignore this email.</p>`,
      }),
      text: `Verify Email Address: ${url}`,
    });
  }

  return sendResponse(data, 'Pendaftaran berhasil', 201);
});
