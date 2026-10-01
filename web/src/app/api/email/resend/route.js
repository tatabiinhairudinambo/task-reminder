import { requireUser } from '@/lib/auth';
import { buildVerificationUrl } from '@/lib/services/auth-service';
import { sendEmail, emailDocument, emailButtonHtml } from '@/lib/services/notification-service';
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

  return sendResponse(null, 'Email verifikasi berhasil dikirim');
});
