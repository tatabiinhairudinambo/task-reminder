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


/**
 * HTML port of resources/views/emails/layouts/base.blade.php plus
 * components/task-card + component/button + component/footer. Rendered inline
 * here because Vercel has no Blade; the markup is kept identical.
 */
export function emailDocument({ subject, bodyHtml }) {
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#fafafa;color:#0a0f1a;font-family:Poppins,'Segoe UI',Tahoma,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#fafafa;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
<tr><td style="background-color:#3b82f6;padding:18px 24px;">
<h1 style="margin:0;font-size:20px;font-weight:600;line-height:1.3;color:#ffffff;">Reminder</h1>
</td></tr>
<tr><td style="padding:24px;">${bodyHtml}</td></tr>
<tr><td style="padding:0 24px 24px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top:1px solid #e2e8f0;padding-top:16px;">
<tr><td style="font-size:12px;line-height:1.6;color:#64748b;text-align:center;">Ac ${year} Reminder. All rights reserved.</td></tr>
</table>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/** resources/views/emails/components/button.blade.php */
export function emailButtonHtml(url, label) {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0;">
<tr><td align="center" bgcolor="#3b82f6" style="border-radius:8px;">
<a href="${url}" target="_blank" style="display:inline-block;padding:12px 20px;font-size:14px;font-weight:600;line-height:1.2;color:#ffffff;text-decoration:none;">${label}</a>
</td></tr>
</table>`;
}

/** resources/views/emails/layouts/base.blade.php + footer + button */
function emailDocumentFooter(dashboardUrl) {
  return emailButtonHtml(dashboardUrl, 'Open Dashboard');
}

/** resources/views/emails/components/task-card.blade.php */
function taskCard({ courseContent, task, deadline, deadlineLabel, deadlineLabelColor, priority, status }) {
  const priorityPill = priority
    ? '<span style="display:inline-block;padding:2px 10px;border-radius:999px;background-color:#dc2626;color:#ffffff;font-size:12px;font-weight:600;margin-left:8px;vertical-align:middle;">Priority</span>'
    : '';

  const deadlineBlock =
    deadline !== undefined && deadline !== null && deadline !== ''
      ? `<p style="margin:0 0 8px;font-size:12px;color:#64748b;">Deadline</p>
<p style="margin:0;font-size:14px;font-weight:600;color:#0a0f1a;">${deadline}${
          deadlineLabel
            ? `<span style="display:inline-block;padding:2px 10px;border-radius:999px;background-color:${
                deadlineLabelColor || '#64748b'
              };color:#ffffff;font-size:12px;font-weight:600;margin-left:8px;vertical-align:middle;">${deadlineLabel}</span>`
            : ''
        }</p>`
      : '';

  const statusBlock = status
    ? `<p style="margin:10px 0 0;"><span style="display:inline-block;padding:4px 10px;border-radius:999px;background-color:${
        status === 'Completed' ? '#16a34a' : '#ef4444'
      };color:#ffffff;font-size:12px;font-weight:600;">${status}</span></p>`
    : '';

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #e2e8f0;background-color:#ffffff;border-radius:10px;margin:12px 0;">
<tr><td style="padding:14px 16px;">
<p style="margin:0 0 8px;font-size:12px;color:#64748b;">Course Content</p>
<p style="margin:0 0 10px;font-size:15px;font-weight:600;color:#0a0f1a;">${courseContent}</p>
<p style="margin:0 0 8px;font-size:12px;color:#64748b;">Task</p>
<p style="margin:0 0 10px;font-size:15px;font-weight:600;color:#0a0f1a;">${task}${priorityPill}</p>
${deadlineBlock}
${statusBlock}
</td></tr>
</table>`;
}

const DASHBOARD_HINT_EMAIL =
  'Lihat detail lengkap tugas di dashboard Anda.';

/** resources/views/emails/task-reminder.blade.php */
function taskReminderEmail(userName, items, taskWord) {
  const cards = items
    .map((item) =>
      taskCard({
        courseContent: item.course_content,
        task: item.task,
        deadline: item.deadline,
        deadlineLabel: item.deadline_label,
        deadlineLabelColor: item.deadline_color,
        priority: item.priority,
      })
    )
    .join('');

  const dashboardUrl = `${frontendBase()}/dashboard`;

  const body = `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#0a0f1a;">Hi ${userName},</p>
<p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#0a0f1a;">You have <strong>${items.length}</strong> ${taskWord} to complete.</p>
${cards}
${emailDocumentFooter(dashboardUrl)}
<p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#64748b;">${DASHBOARD_HINT_EMAIL}</p>`;

  return emailDocument({ subject: 'Task Reminder Notification', bodyHtml: body });
}

/** FRONTEND_URL (or APP_URL) with no trailing slash. */
function frontendBase() {
  const base = (process.env.FRONTEND_URL || process.env.APP_URL || '').trim();

  return base === '' ? '' : base.replace(/\/$/, '');
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
      subject: 'Task Created Notification',
      html: emailDocument({
        subject: 'Task Created Notification',
        bodyHtml: `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#0a0f1a;">Hi ${user.name},</p>
<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#0a0f1a;">You just created a new task. Here are the details:</p>
${taskCard({ courseContent, task, deadline: longDateId(deadline) })}
${emailDocumentFooter(`${frontendBase()}/dashboard`)}
<p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#64748b;">${DASHBOARD_HINT_EMAIL}</p>`,
      }),
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
      subject: 'Notifikasi Tugas Selesai',
      html: emailDocument({
        subject: 'Notifikasi Tugas Selesai',
        bodyHtml: `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#0a0f1a;">Hi ${user.name},</p>
<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#0a0f1a;">Great job! You completed a task:</p>
${taskCard({ courseContent, task, status: 'Completed' })}
${emailDocumentFooter(`${frontendBase()}/dashboard`)}
<p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#64748b;">${DASHBOARD_HINT_EMAIL}</p>`,
      }),
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
 *
 * Selection mirrors SendReminderEmailNotifications: a task is reminded when
 * `deadline` equals the setting's reminder date, today, tomorrow, OR it has
 * priority - and is still open. Overdue tasks are NOT included unless they
 * are priority flagged, exactly like the Laravel command.
 */
export async function sendReminderDigest(userId, referenceDate = new Date()) {
  const setting = await prisma.setting.findUnique({ where: { user_id: userId } });
  if (!setting) return { channels: [], count: 0 };

  const today = dateInZone(referenceDate);
  const tomorrow = shiftDays(today, 1);
  const reminderDay = shiftDays(today, Number.parseInt(setting.deadline_notification, 10) || 0);

  const tasks = await prisma.task.findMany({
    where: {
      user_id: userId,
      status: false,
      OR: [
        { deadline: dateValue(reminderDay) },
        { deadline: dateValue(today) },
        { deadline: dateValue(tomorrow) },
        { priority: true },
      ],
    },
    orderBy: { deadline: 'asc' },
    include: { courseContent: { select: { course_content: true } } },
  });

  if (tasks.length === 0) return { channels: [], count: 0 };

  // ReminderNotification sorts priority first, then nearest deadline, and the
  // email renders `j F Y` in the app locale (id, because .env sets APP_LOCALE).
  const notifications = tasks
    .map((task) => ({
      task: task.task,
      description: task.description,
      course_content: task.courseContent?.course_content ?? '-',
      // ISO date keeps the payload parseable; the label is rendered at send time.
      deadline: task.deadline.toISOString().slice(0, 10),
      deadline_label: deadlineLabelFor(task),
      priority: task.priority,
    }))
    .sort((a, b) => {
      const byPriority = Number(Boolean(b.priority)) - Number(Boolean(a.priority));
      if (byPriority !== 0) return byPriority;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });

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
    const formatted = notifications.map((n) => ({
      course_content: n.course_content,
      task: n.task,
      // Laravel's mail view rendered the translated date itself.
      deadline: longDateId(n.deadline),
      deadline_label: n.deadline_label ?? null,
      deadline_color: deadlineBadgeColor(n.deadline_label),
      priority: Boolean(n.priority),
    }));
    const taskWord = formatted.length === 1 ? 'task' : 'tasks';

    await sendEmail({
      to: user.email,
      subject: 'Task Reminder Notification',
      html: taskReminderEmail(user.name, formatted, taskWord),
      text: formatted.map((n) => `${n.task} (${n.course_content}) — ${n.deadline}`).join('\n'),
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
      subject: 'Test Notification',
      html: emailDocument({
        subject: 'Test Notification',
        bodyHtml: `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#0a0f1a;">Hi ${user.name},</p>
<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#0a0f1a;">This is a test notification from Task Reminder.</p>
<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#0a0f1a;">If you receive this email, your notification setup is working correctly.</p>
${emailDocumentFooter(`${frontendBase()}/dashboard`)}
<p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#64748b;">You can safely ignore this message.</p>`,
      }),
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

    // Laravel passed the stored channel (email/telegram/both) into the test
    // message so "*Channel:*" reflects the actual setting.
    const ok = await sendMessage(
      setting.telegram_chat_id,
      buildTestMessage(setting.notification_channel)
    );

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

/** "YYYY-MM-DD" for a Date, in the app timezone (not the server's). */
function dateInZone(value) {
  const timeZone = process.env.APP_TIMEZONE || 'Asia/Jakarta';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value instanceof Date ? value : new Date(value));

  const get = (type) => parts.find((p) => p.type === type)?.value;

  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Shift a "YYYY-MM-DD" string by N days (UTC-based, date-only). */
function shiftDays(isoDay, days) {
  const [y, m, d] = isoDay.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" -> Date at UTC midnight, the value Prisma compares for @db.Date. */
function dateValue(isoDay) {
  const [y, m, d] = isoDay.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** `j F Y` in Indonesian, matching Carbon's translatedFormat under APP_LOCALE=id. */
function longDateId(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value ?? '');

  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: process.env.APP_TIMEZONE || 'Asia/Jakarta',
  }).format(d);
}

/**
 * Badge color for a deadline label, mirroring Task::deadlineBadgeColor
 * (green selesai, red terlambat/hari ini/d<=1, amber d<=5, otherwise slate).
 */
function deadlineBadgeColor(label) {
  const normalized = String(label ?? '').toLowerCase().trim();

  if (normalized.includes('selesai') || normalized.includes('completed')) {
    return '#16a34a';
  }

  if (
    normalized.includes('terlambat') ||
    normalized.includes('overdue') ||
    normalized.includes('hari ini') ||
    normalized.includes('today')
  ) {
    return '#dc2626';
  }

  const match = normalized.match(/^(\d+)\s*hari/);

  if (match) {
    const days = Number(match[1]);
    if (days <= 1) return '#dc2626';
    if (days <= 5) return '#d97706';
    return '#64748b';
  }

  return '#64748b';
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
