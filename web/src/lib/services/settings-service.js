import { prisma } from '@/lib/db';
import { ApiError } from '@/lib/api-response';
import { serializeSetting, num } from '@/lib/serialize';
import { encrypt, decrypt } from '@/lib/crypto';
import { toBoolean } from '@/lib/validation';

// Port of App\Services\SettingsService.

const CHANNELS = ['email', 'telegram', 'both'];

async function settingsOf(userId) {
  const setting = await prisma.setting.findUnique({ where: { user_id: userId } });

  if (!setting) {
    throw new ApiError('Pengaturan tidak ditemukan', 404);
  }

  return setting;
}

export async function getSettings(userId) {
  const setting = await prisma.setting.findUnique({ where: { user_id: userId } });

  return {
    id: setting ? num(setting.id) : null,
    deadline_notification: setting?.deadline_notification ?? null,
    task_created_notification: setting ? (setting.task_created_notification ? 1 : 0) : null,
    task_completed_notification: setting ? (setting.task_completed_notification ? 1 : 0) : null,
    notification_channel: setting?.notification_channel ?? null,
    telegram_chat_id: setting?.telegram_chat_id ?? null,
    has_siakang_credentials: Boolean(setting?.siakang_email && setting?.siakang_password),
  };
}

export async function updateDeadlineNotification(userId, value) {
  const setting = await settingsOf(userId);

  const updated = await prisma.setting.update({
    where: { id: setting.id },
    data: { deadline_notification: value },
  });

  return serializeSetting(updated);
}

export async function updateNotificationChannel(userId, channel) {
  const setting = await settingsOf(userId);
  const normalized = String(channel).trim().toLowerCase();

  if (!CHANNELS.includes(normalized)) {
    throw new ApiError('Channel notifikasi tidak valid', 422);
  }

  if (['telegram', 'both'].includes(normalized) && !setting.telegram_chat_id) {
    throw new ApiError('Atur Telegram Chat ID terlebih dahulu', 422);
  }

  const updated = await prisma.setting.update({
    where: { id: setting.id },
    data: { notification_channel: normalized },
  });

  return serializeSetting(updated);
}

/**
 * Set/clear the Telegram chat id. Clearing it while the channel is
 * telegram/both resets the channel to email, matching Laravel.
 */
export async function updateTelegramChatId(userId, chatId) {
  const setting = await settingsOf(userId);

  const trimmed = chatId === null || chatId === undefined ? '' : String(chatId).trim();
  const nextChatId = trimmed === '' ? null : trimmed;

  const resetChannel =
    nextChatId === null && ['telegram', 'both'].includes(setting.notification_channel);

  const updated = await prisma.setting.update({
    where: { id: setting.id },
    data: {
      telegram_chat_id: nextChatId,
      ...(resetChannel ? { notification_channel: 'email' } : {}),
    },
  });

  return serializeSetting(updated);
}

export async function toggleTaskCreatedNotification(userId) {
  const setting = await settingsOf(userId);

  const updated = await prisma.setting.update({
    where: { id: setting.id },
    data: { task_created_notification: !setting.task_created_notification },
  });

  return serializeSetting(updated);
}

export async function toggleTaskCompletedNotification(userId) {
  const setting = await settingsOf(userId);

  const updated = await prisma.setting.update({
    where: { id: setting.id },
    data: { task_completed_notification: !setting.task_completed_notification },
  });

  return serializeSetting(updated);
}

/** Store Siakang credentials (encrypted with APP_KEY). */
export async function saveSiakangCredentials(userId, email, password) {
  const setting = await settingsOf(userId);

  await prisma.setting.update({
    where: { id: setting.id },
    data: {
      siakang_email: encrypt(email.trim()),
      siakang_password: encrypt(password),
    },
  });

  return { has_siakang_credentials: true };
}

export async function clearSiakangCredentials(userId) {
  const setting = await settingsOf(userId);

  await prisma.setting.update({
    where: { id: setting.id },
    data: { siakang_email: null, siakang_password: null },
  });

  return { has_siakang_credentials: false };
}

/** Decrypt stored credentials, or null when unset. */
export async function siakangCredentialsOf(userId) {
  const setting = await prisma.setting.findUnique({ where: { user_id: userId } });

  if (!setting?.siakang_email || !setting?.siakang_password) {
    return null;
  }

  const email = decrypt(setting.siakang_email);
  const password = decrypt(setting.siakang_password);

  if (!email || !password) {
    return null;
  }

  // Laravel trimmed the stored password at every call site before handing it
  // to the bridge.
  return { email: email.trim(), password: password.trim() };
}

export { toBoolean, serializeSetting };
