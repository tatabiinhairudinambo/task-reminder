// Serialization layer: Prisma types -> the exact JSON shapes the existing SPA
// (and the Laravel clients) expect.
//
// The SPA was written against Laravel's Eloquent output. Prisma returns
// different JavaScript types for the same columns, so every response must pass
// through these helpers:
//
//   BigInt   -> number          (Eloquent `$table->id()` -> integer in JSON)
//   Decimal  -> "12.34" string  (Laravel decimals serialize as strings)
//   Boolean  -> 1 | 0           (models cast status/priority to integer)
//   DateTime -> "2026-09-25"    (date columns, no time part)
//   DateTime -> "08:00"         (time columns)

/** BigInt (or number) -> number. Falls back to null for nullish input. */
export function num(value) {
  if (value === null || value === undefined) return null;
  return typeof value === 'bigint' ? Number(value) : Number(value);
}

/** Decimal (Prisma.Decimal) -> "12.34" string, matching Laravel. */
export function decimal2(value) {
  if (value === null || value === undefined) return null;
  return Number(value).toFixed(2);
}

/** Boolean -> 1 | 0, matching the `status`/`priority` integer casts. */
export function boolInt(value) {
  return value ? 1 : 0;
}

/** Date column -> "YYYY-MM-DD" (Laravel `$table->date()` has no time part). */
export function dateOnly(value) {
  if (value === null || value === undefined) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/** Time column -> "HH:mm" (`hour_start` / `hour_end`). */
export function timeOnly(value) {
  if (value === null || value === undefined) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(11, 16);
}

/** Timestamp -> Laravel's ISO-8601 `toJSON()` form. */
export function timestamp(value) {
  if (value === null || value === undefined) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * Deadline label, byte-for-byte equivalent to
 * `Task::getDeadlineLabelAttribute()`.
 *
 * It compares CALENDAR DAYS in the app timezone, which is why the Laravel
 * config requires APP_TIMEZONE=Asia/Jakarta: without it a task due today is
 * mislabelled "1 hari lagi" between 00:00 and 07:00 WIB.
 */
export function deadlineLabel(deadline, status, timeZone = process.env.APP_TIMEZONE || 'Asia/Jakarta') {
  if (boolInt(status) === 1) return 'Selesai';

  const deadlineDay = startOfDayInZone(deadline, timeZone);
  const today = startOfDayInZone(new Date(), timeZone);

  if (today > deadlineDay) return 'Terlambat';

  const diffInDays = Math.round((deadlineDay - today) / 86400000);

  if (diffInDays === 0) return 'Jatuh tempo hari ini';
  if (diffInDays === 1) return '1 hari lagi';

  return `${diffInDays} hari lagi`;
}

/**
 * Midnight of a given date in a named timezone, as an epoch millisecond value.
 *
 * `Date.UTC(y, m, d)` gives a stable day bucket for comparison; the point is
 * only that both sides are bucketed in the SAME zone, so DST and local-server
 * timezone never shift the result.
 */
function startOfDayInZone(value, timeZone) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return NaN;

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);

  const get = (type) => Number(parts.find((p) => p.type === type)?.value);

  return Date.UTC(get('year'), get('month') - 1, get('day'));
}

/** Serialize a Task row (no relations) exactly like the Eloquent model. */
export function serializeTask(task, options = {}) {
  const base = {
    id: num(task.id),
    task: task.task,
    description: task.description ?? null,
    deadline: dateOnly(task.deadline),
    priority: boolInt(task.priority),
    status: boolInt(task.status),
    user_id: num(task.user_id),
    course_content_id: num(task.course_content_id),
    created_at: timestamp(task.created_at),
    updated_at: timestamp(task.updated_at),
    deadline_label: deadlineLabel(task.deadline, task.status, options.timeZone),
  };

  if (options.withCourseContent && task.courseContent) {
    base.course_content = serializeCourseContent(task.courseContent);
  }

  return base;
}

/** Serialize a CourseContent row (no relations). */
export function serializeCourseContent(content) {
  return {
    id: num(content.id),
    semester: content.semester,
    code: content.code,
    course_content: content.course_content,
    credits: num(content.credits),
    score: decimal2(content.score),
    lecturer: content.lecturer,
    day: content.day,
    hour_start: timeOnly(content.hour_start),
    hour_end: timeOnly(content.hour_end),
    user_id: num(content.user_id),
  };
}

/** Serialize a Grade row. Decimals become 2-dp strings. */
export function serializeGrade(grade) {
  return {
    id: num(grade.id),
    grade: grade.grade,
    grade_point: decimal2(grade.grade_point),
    minimal_score: decimal2(grade.minimal_score),
    maximal_score: decimal2(grade.maximal_score),
    user_id: num(grade.user_id),
  };
}

/**
 * Serialize a Setting row. `siakang_email` / `siakang_password` are `$hidden`
 * in Laravel and must never be returned.
 */
export function serializeSetting(setting, options = {}) {
  if (!setting) return null;

  const base = {
    id: num(setting.id),
    deadline_notification: setting.deadline_notification,
    task_created_notification: boolInt(setting.task_created_notification),
    task_completed_notification: boolInt(setting.task_completed_notification),
    notification_channel: setting.notification_channel,
    telegram_chat_id: setting.telegram_chat_id ?? null,
    user_id: num(setting.user_id),
  };

  if (options.withSiakangFlag) {
    base.has_siakang_credentials =
      options.hasSiakangCredentials ??
      Boolean(setting.siakang_email && setting.siakang_password);
  }

  return base;
}

/** Serialize a User row. `password` / `remember_token` are `$hidden`. */
export function serializeUser(user) {
  return {
    id: num(user.id),
    name: user.name,
    email: user.email,
    email_verified_at: timestamp(user.email_verified_at),
    created_at: timestamp(user.created_at),
    updated_at: timestamp(user.updated_at),
  };
}
