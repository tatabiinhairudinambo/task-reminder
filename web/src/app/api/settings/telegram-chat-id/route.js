import { requireVerifiedUser } from '@/lib/auth';
import { updateTelegramChatId } from '@/lib/services/settings-service';
import { sendResponse, sendValidationError, route } from '@/lib/api-response';
import { updateTelegramChatIdSchema } from '@/lib/validation';

// PUT /api/settings/telegram-chat-id

export const PUT = route(async (request) => {
  const user = await requireVerifiedUser();
  const body = await request.json().catch(() => ({}));
  const parsed = updateTelegramChatIdSchema.safeParse(body);

  if (!parsed.success) {
    return sendValidationError(parsed.error);
  }

  const setting = await updateTelegramChatId(user.id, parsed.data.telegram_chat_id ?? null);

  return sendResponse(setting, 'Telegram Chat ID berhasil diperbarui');
});
