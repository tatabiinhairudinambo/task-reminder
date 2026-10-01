import { prisma } from '@/lib/db';
import { serializeSetting } from '@/lib/serialize';
import { sendMessage, buildTestMessage, escapeMarkdownV2 } from '@/lib/services/telegram-service';

// Notification orchestration.
//
// Laravel queued these on the database driver and a systemd worker delivered
// them. Vercel has no long-running worker, so each notification is sent
// inline from the request that triggered it (or from the cron endpoint for
// reminders). That keeps delivery correct without a queue; the trade-off is a
// few hundred ms of extra latency on the triggering request.

function wantsEmail(setting) {
  return ['email', 'both'].includes(setting?.notification_channel);
}

function wantsTelegram(setting) {
  return ['telegram', 'both'].includes(setting?.notification_channel);
}

/**
 * Send an email through Resend's HTTP API.
 *
 * Why not SMTP? Serverless functions cannot hold a long-lived SMTP session
 * reliably. Set MAIL_PROVIDER=log to print to the function log during local
 * development instead.
 */
export async function sendEmail({ to, subject, html, text }) {
  const provider = process.env.MAIL_PROVIDER || 'log';

  if (provider === 'log') {
    console.info('[mail:log]', { to, subject });
    return { sent: true, provider: 'log' };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM_ADDRESS || 'no-reply@example.com';

  if (!apiKey) {
    console.warn('[mail] RESEND_API_KEY is not set; skipping send.');
    return { sent: false, provider: 'resend', reason: 'missing_api_key' };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [to], subject, html, text }),
  });

  if (!response.ok) {
    console.warn('[mail] send failed', response.status, await response.text());
    return { sent: false, provider: 'resend', reason: `http_${response.status}` };
  }

  return { sent: true, provider: 'resend' };
}

function emailLayout(title, bodyHtml) {
  return `<!doctype html><html><body style="font-family:Poppins,Arial,sans-serif;color:#0f172a">
<h2 style="color:#2563eb">${title}</h2>${bodyHtml}
<p style="color:#64748b;font-size:12px">Task Reminder</p>
</body></html>`;
}

/** Notify that a task was created, honouring the user's channel setting. */
export async function notifyTaskCreated(userId, { courseContent, task, deadline, description }) {
  const setting = await prisma.setting.findUnique({ where: { user_id: userId } });
  if (!setting || !setting.task_created_notification) return [];

  const channels = [];

  if (wantsEmail(setting) && userEmail(userId)) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    await sendEmail({
      to: user.email,
      subject: `Tugas baru: ${task}`,
      html: emailLayout(
        'Notifikasi Tugas Dibuat',
        `<p><strong>Mata Kuliah:</strong> ${courseContent}</p>
         <p><strong>Tugas:</strong> ${task}</p>
         <p><strong>Tenggat:</strong> ${deadline}</p>
         ${description ? `<p><strong>Deskripsi:</strong> ${description}</p>` : ''}`
      ),
      text: `Tugas baru: ${task} (${courseContent}), tenggat ${deadline}`,
    });
    channels.push('email');
  }

  if (wantsTelegram(setting) && setting.telegram_chat_id) {
    const { buildTaskCreatedMessage } = await import('@/lib/services/telegram-service');
    await sendMessage(
      setting.telegram_chat_id,
      buildTaskCreatedMessage(courseContent, task, deadline, description)
    );
    channels.push('telegram');
  }

  return channels;
}

/** Notify that a task was completed. */
export async function notifyTaskCompleted(userId, { courseContent, task, description }) {
  const setting = await prisma.setting.findUnique({ where: { user_id: userId } });
  if (!setting || !setting.task_completed_notification) return [];

  const channels = [];

  if (wantsEmail(setting)) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    await sendEmail({
      to: user.email,
      subject: `Tugas selesai: ${task}`,
      html: emailLayout(
        'Notifikasi Tugas Selesai',
        `<p><strong>Mata Kuliah:</strong> ${courseContent}</p>
         <p><strong>Tugas:</strong> ${task}</p>`
      ),
      text: `Tugas selesai: ${task} (${courseContent})`,
    });
    channels.push('email');
  }

  if (wantsTelegram(setting) && setting.telegram_chat_id) {
    const { buildTaskCompletedMessage } = await import('@/lib/services/telegram-service');
    await sendMessage(
      setting.telegram_chat_id,
      buildTaskCompletedMessage(courseContent, task, description)
    );
    channels.push('telegram');
  }

  return channels;
}

/**
 * Send the daily reminder digest for one user.
 * Returns the channels that actually accepted the message.
 */
export async function sendReminderDigest(userId) {
  const setting = await prisma.setting.findUnique({ where: { user_id: userId } });
  if (!setting) return { channels: [], count: 0 };

  const today = new Date();
  const horizon = new Date(today.getTime() + 7 * 86400000);

  const tasks = await prisma.task.findMany({
    where: {
      user_id: userId,
      status: false,
      deadline: { lte: horizon },
    },
    orderBy: { deadline: 'asc' },
    include: { courseContent: { select: { course_content: true } } },
  });

  if (tasks.length === 0) return { channels: [], count: 0 };

  const notifications = tasks.map((task) => ({
    task: task.task,
    description: task.description,
    course_content: task.courseContent?.course_content ?? '-',
    // ISO date keeps the payload parseable; the label is rendered at send time.
    deadline: task.deadline.toISOString().slice(0, 10),
    deadline_label: deadlineLabelFor(task),
    priority: task.priority,
  }));

  const channels = [];

  if (wantsTelegram(setting) && setting.telegram_chat_id) {
    const { buildReminderSummaryMessages } = await import('@/lib/services/telegram-service');
    const messages = buildReminderSummaryMessages(notifications);

    let allSent = true;
    for (const message of messages) {
      const ok = await sendMessage(setting.telegram_chat_id, message);
      if (!ok) allSent = false;
    }

    if (allSent) channels.push('telegram');
  }

  if (wantsEmail(setting)) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const rows = notifications
      .map(
        (n) =>
          `<li><strong>${n.task}</strong> — ${n.course_content} (${n.deadline} · ${n.deadline_label})</li>`
      )
      .join('');

    await sendEmail({
      to: user.email,
      subject: 'Pengingat tugas',
      html: emailLayout(
        'Notifikasi Pengingat Tugas',
        `<p>Anda memiliki <strong>${notifications.length}</strong> tugas tertunda:</p><ul>${rows}</ul>`
      ),
      text: notifications.map((n) => `${n.task} (${n.course_content}) — ${n.deadline}`).join('\n'),
    });
    channels.push('email');
  }

  return { channels, count: notifications.length };
}

/** Send the "test notification" from Settings. Throws on Telegram failure. */
export async function sendTestNotification(userId) {
  const setting = await prisma.setting.findUnique({ where: { user_id: userId } });
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    const error = new Error('Pengguna tidak ditemukan');
    error.code = 404;
    throw error;
  }

  const channels = [];

  if (wantsEmail(setting)) {
    await sendEmail({
      to: user.email,
      subject: 'Notifikasi Uji',
      html: emailLayout(
        'Notifikasi Uji',
        '<p>Ini adalah notifikasi uji dari Task Reminder</p><p><strong>Channel:</strong> Email</p>'
      ),
      text: 'Ini adalah notifikasi uji dari Task Reminder',
    });
    channels.push('email');
  }

  if (wantsTelegram(setting)) {
    if (!setting?.telegram_chat_id) {
      const error = new Error('Atur Telegram Chat ID terlebih dahulu');
      error.code = 422;
      throw error;
    }

    const ok = await sendMessage(setting.telegram_chat_id, buildTestMessage('Telegram'));

    if (!ok) {
      const error = new Error('Gagal mengirim notifikasi uji Telegram');
      error.code = 502;
      throw error;
    }

    channels.push('telegram');
  }

  if (channels.length === 0) {
    const error = new Error('Tidak ada channel notifikasi yang aktif');
    error.code = 422;
    throw error;
  }

  return { channels };
}

function userEmail() {
  return true;
}

function deadlineLabelFor(task) {
  const status = task.status ? 1 : 0;
  if (status === 1) return 'Selesai';

  const timeZone = process.env.APP_TIMEZONE || 'Asia/Jakarta';
  const dayOf = (value) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(value instanceof Date ? value : new Date(value));
    const get = (t) => Number(parts.find((p) => p.type === t)?.value);
    return Date.UTC(get('year'), get('month') - 1, get('day'));
  };

  const deadlineDay = dayOf(task.deadline);
  const today = dayOf(new Date());

  if (today > deadlineDay) return 'Terlambat';

  const diff = Math.round((deadlineDay - today) / 86400000);
  if (diff === 0) return 'Jatuh tempo hari ini';
  if (diff === 1) return '1 hari lagi';

  return `${diff} hari lagi`;
}

export { escapeMarkdownV2, serializeSetting };
