import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { ApiError } from '@/lib/api-response';
import { serializeUser, num } from '@/lib/serialize';

// Port of App\Services\UserService.

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 12);

export async function getAuthenticatedUser(user) {
  const setting = await prisma.setting.findUnique({ where: { user_id: user.id } });

  return {
    user: {
      id: num(user.id),
      name: user.name,
      email: user.email,
    },
    settings: setting
      ? {
          id: num(setting.id),
          deadline_notification: setting.deadline_notification,
          task_created_notification: setting.task_created_notification ? 1 : 0,
          task_completed_notification: setting.task_completed_notification ? 1 : 0,
          notification_channel: setting.notification_channel,
          telegram_chat_id: setting.telegram_chat_id ?? null,
          user_id: num(setting.user_id),
          has_siakang_credentials: Boolean(setting.siakang_email && setting.siakang_password),
        }
      : null,
  };
}

/**
 * Update name/email. Changing the email clears `email_verified_at` and
 * resends verification; a same-email update keeps the verified flag.
 * Returns { user, verificationUrl } so the route can send the mail.
 */
export async function updateProfile(user, { name, email }) {
  const emailChanged = email !== user.email;

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      name,
      email,
      ...(emailChanged ? { email_verified_at: null } : {}),
      updated_at: new Date(),
    },
  });

  return { user: updated, emailChanged };
}

export async function changePassword(user, oldPassword, newPassword) {
  const valid = await bcrypt.compare(oldPassword, user.password);

  if (!valid) {
    throw new ApiError('Current password is incorrect', 401);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: await bcrypt.hash(newPassword, BCRYPT_ROUNDS),
      updated_at: new Date(),
    },
  });

  return true;
}

export { serializeUser };
