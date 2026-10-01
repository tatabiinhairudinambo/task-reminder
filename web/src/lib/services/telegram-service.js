// Port of App\Services\TelegramService.
//
// Sends MarkdownV2 via the Bot API. Reminders are chunked so a digest never
// exceeds Telegram's 4096-character limit (UTF-16 code units) - a single
// oversized message is rejected by the API and the reminder would be lost.

const DASHBOARD_HINT = 'Lihat detail lengkap tugas di dashboard Anda.';
const DESCRIPTION_LIMIT = 300;
const MESSAGE_LIMIT = 4096;
const NUMBERING_LIMIT = 32;

export function escapeMarkdownV2(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

function dashboardUrl() {
  const base = (process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000').trim();
  return `${base.replace(/\/$/, '')}/dashboard`;
}

function descriptionText(description) {
  if (description === null || description === undefined) return null;

  // Collapse to a single printable line.
  let collapsed = String(description).replace(/\s+/gu, ' ').trim();
  if (collapsed === '') return null;

  if ([...collapsed].length > DESCRIPTION_LIMIT) {
    collapsed = [...collapsed].slice(0, DESCRIPTION_LIMIT).join('') + '…';
  }

  return collapsed;
}

/** `j F Y` in Indonesian, matching Carbon's translatedFormat. */
function longDate(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value ?? '');

  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: process.env.APP_TIMEZONE || 'Asia/Jakarta',
  }).format(d);
}

export function buildTaskCreatedMessage(courseContent, task, deadline, description = null) {
  const lines = [
    '*Notifikasi Tugas Dibuat*',
    '',
    `*Mata Kuliah:* ${escapeMarkdownV2(courseContent)}`,
    `*Tugas:* ${escapeMarkdownV2(task)}`,
    `*Tenggat:* ${escapeMarkdownV2(longDate(deadline))}`,
  ];

  const desc = descriptionText(description);
  if (desc !== null) lines.push(`*Deskripsi:* ${escapeMarkdownV2(desc)}`);

  lines.push('', escapeMarkdownV2(DASHBOARD_HINT), '', `[Buka dashboard](${dashboardUrl()})`);

  return lines.join('\n');
}

export function buildTaskCompletedMessage(courseContent, task, description = null) {
  const lines = [
    '*Notifikasi Tugas Selesai*',
    '',
    `*Mata Kuliah:* ${escapeMarkdownV2(courseContent)}`,
    `*Tugas:* ${escapeMarkdownV2(task)}`,
  ];

  const desc = descriptionText(description);
  if (desc !== null) lines.push(`*Deskripsi:* ${escapeMarkdownV2(desc)}`);

  lines.push('', escapeMarkdownV2(DASHBOARD_HINT), '', `[Buka dashboard](${dashboardUrl()})`);

  return lines.join('\n');
}

/** Sort priority tasks first, then soonest deadline. Mirrors ReminderNotification. */
export function sortByPriorityAndDeadline(notifications) {
  return [...notifications].sort((a, b) => {
    const priorityDiff = Number(Boolean(b.priority)) - Number(Boolean(a.priority));
    if (priorityDiff !== 0) return priorityDiff;

    return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
  });
}

function reminderBlock(notification, index) {
  const block = [`*Pengingat ${escapeMarkdownV2(String(index + 1))}*`];

  if (notification.priority) block.push('*Prioritas*');

  block.push(`*Tugas:* ${escapeMarkdownV2(notification.task)}`);
  block.push(`*Mata Kuliah:* ${escapeMarkdownV2(notification.course_content)}`);

  let deadline = longDate(notification.deadline);
  if (notification.deadline_label) deadline += ` (${notification.deadline_label})`;

  block.push(`*Tenggat:* ${escapeMarkdownV2(deadline)}`);

  const desc = descriptionText(notification.description);
  if (desc !== null) block.push(`*Deskripsi:* ${escapeMarkdownV2(desc)}`);

  return block.join('\n');
}

function chunkBlocks(blocks, headerLength, footerLength) {
  const reserved = headerLength + footerLength + 4 + NUMBERING_LIMIT;

  const chunks = [];
  let current = [];
  let currentLength = 0;

  for (const block of blocks) {
    const blockLength = [...block].length;
    let added = blockLength + (current.length === 0 ? 0 : 2);

    if (current.length > 0 && reserved + currentLength + added > MESSAGE_LIMIT) {
      chunks.push(current.join('\n\n'));
      current = [];
      currentLength = 0;
      added = blockLength;
    }

    current.push(block);
    currentLength += added;
  }

  chunks.push(current.join('\n\n'));

  return chunks;
}

/** Split a reminder digest into one or more Telegram-sized messages. */
export function buildReminderSummaryMessages(notifications) {
  const sorted = sortByPriorityAndDeadline(notifications);
  const count = sorted.length;

  const header = [
    '*Notifikasi Pengingat Tugas*',
    '',
    `Anda memiliki *${escapeMarkdownV2(String(count))}* ${escapeMarkdownV2('tugas')} tertunda`,
  ].join('\n');

  const footer = [escapeMarkdownV2(DASHBOARD_HINT), '', `[Buka dashboard](${dashboardUrl()})`].join('\n');

  const blocks = sorted.map((n, i) => reminderBlock(n, i));
  const chunks = chunkBlocks(blocks, [...header].length, [...footer].length);

  if (chunks.length === 1) {
    return [`${header}\n\n${chunks[0]}\n\n${footer}`];
  }

  const total = chunks.length;

  return chunks.map(
    (chunk, index) =>
      `${header}\n\n${chunk}\n\n${footer}\n\n${escapeMarkdownV2(
        `Pesan ${index + 1} dari ${total}`
      )}`
  );
}

export function buildReminderSummaryMessage(notifications) {
  return buildReminderSummaryMessages(notifications)[0];
}

export function buildTestMessage(channel) {
  return [
    '*Notifikasi Uji*',
    '',
    'Ini adalah notifikasi uji dari Task Reminder',
    `*Channel:* ${escapeMarkdownV2(channel)}`,
    '*Status:* Pengaturan Telegram berfungsi',
    '',
    `[Buka dashboard](${dashboardUrl()})`,
  ].join('\n');
}

/** POST a message to the Bot API. Returns false (never throws) on failure. */
export async function sendMessage(chatId, message, parseMode = 'MarkdownV2') {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    console.warn('[telegram] skipped: TELEGRAM_BOT_TOKEN is not configured.');
    return false;
  }

  const body = new URLSearchParams({
    chat_id: chatId,
    text: message,
    disable_web_page_preview: 'true',
    parse_mode: parseMode,
  });

  // Laravel retried 3 times with a 500ms backoff.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        console.warn('[telegram] send failed', response.status, await response.text());
        return false;
      }

      return true;
    } catch (error) {
      if (attempt === 2) {
        console.warn('[telegram] send threw', error.message);
        return false;
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return false;
}

export async function sendTestNotification(chatId, channel) {
  return sendMessage(chatId, buildTestMessage(channel));
}

export { DASHBOARD_HINT, MESSAGE_LIMIT };
