import { z } from 'zod';

// Zod ports of the 21 Laravel Form Requests. Messages are Indonesian for the
// user-facing ones and English where Laravel's default English message was
// surfaced to users (e.g. score bounds).
//
// Every `authorize()` in Laravel returned `true`; ownership is enforced in the
// service layer with `where('user_id', ...)`, which the Next routes replicate.

// ---------------------------------------------------------------- helpers

// Laravel's `exists:course_contents,id` / ownership checks happen in services,
// not here; the schema only guards shape and primitive ranges.

// ---------------------------------------------------------------- auth

export const loginSchema = z.object({
  email: z.string().email('Kolom email harus berupa alamat email yang valid.'),
  password: z.string().min(1, 'Kolom password wajib diisi.'),
  remember_me: z.boolean().optional(),
});

export const registerSchema = z.object({
  name: z.string().min(1, 'Kolom name wajib diisi.'),
  email: z.string().email('Kolom email harus berupa alamat email yang valid.'),
  password: z.string().min(8, 'Kolom password minimal berisi 8 karakter.'),
  password_confirmation: z.string().min(1, 'Kolom password confirmation wajib diisi.'),
}).refine((data) => data.password === data.password_confirmation, {
  message: 'Kolom password confirmation harus sama dengan password.',
  path: ['password_confirmation'],
});

export const sendResetLinkSchema = z.object({
  email: z.string().email('Kolom email harus berupa alamat email yang valid.'),
});

export const resetPasswordSchema = z.object({
  email: z.string().email('Kolom email harus berupa alamat email yang valid.'),
  token: z.string().min(1, 'Kolom token wajib diisi.'),
  password: z.string().min(8, 'Kolom password minimal berisi 8 karakter.'),
  password_confirmation: z.string().min(1, 'Kolom password confirmation wajib diisi.'),
}).refine((data) => data.password === data.password_confirmation, {
  message: 'Kolom password confirmation harus sama dengan password.',
  path: ['password_confirmation'],
});

// ---------------------------------------------------------------- user

export const updateProfileSchema = z.object({
  name: z.string().min(1, 'Kolom name wajib diisi.'),
  email: z.string().email('Kolom email harus berupa alamat email yang valid.'),
});

export const changePasswordSchema = z.object({
  old_password: z.string().min(1, 'Kolom old password wajib diisi.'),
  password: z.string().min(8, 'Kolom password minimal berisi 8 karakter.'),
  password_confirmation: z.string().min(1, 'Kolom password confirmation wajib diisi.'),
}).refine((data) => data.password === data.password_confirmation, {
  message: 'Kolom password confirmation harus sama dengan password.',
  path: ['password_confirmation'],
});

// ---------------------------------------------------------------- tasks

export const storeTaskSchema = z.object({
  task: z.string().min(1, 'Kolom task wajib diisi.'),
  description: z.string().nullable().optional(),
  deadline: z.string().min(1, 'Kolom deadline wajib diisi.'),
  priority: z.union([z.boolean(), z.number(), z.string()]).optional(),
  course_content_id: z.union([z.number(), z.string()]).refine(
    (v) => v !== '' && v !== null && v !== undefined,
    'Kolom course content id wajib diisi.'
  ),
});

export const updateTaskSchema = storeTaskSchema;

// ---------------------------------------------------------------- course contents

export const storeCourseContentSchema = z.object({
  semester: z.string().min(1, 'Kolom semester wajib diisi.'),
  code: z.string().min(1, 'Kolom code wajib diisi.'),
  course_content: z.string().min(1, 'Kolom course content wajib diisi.'),
  credits: z.coerce.number().int('Kolom credits harus berupa bilangan bulat.').min(1, 'Kolom credits minimal berisi 1.'),
  lecturer: z.string().min(1, 'Kolom lecturer wajib diisi.'),
  day: z.string().min(1, 'Kolom day wajib diisi.'),
  hour_start: z.string().min(1, 'Kolom hour start wajib diisi.'),
  hour_end: z.string().min(1, 'Kolom hour end wajib diisi.'),
});

export const updateCourseContentSchema = storeCourseContentSchema;

export const clearSemesterSchema = z.object({
  semester: z.string().min(1, 'Kolom semester wajib diisi.'),
});

export const syncScheduleSchema = z.object({
  semester: z.string().min(1, 'Kolom semester wajib diisi.'),
  source_semester: z.string().nullable().optional(),
});

// ---------------------------------------------------------------- assessment

export const updateAssessmentSchema = z.object({
  // `nullable` is deliberate: sending null explicitly clears the score.
  score: z
    .union([z.number(), z.string(), z.null()])
    .optional()
    .transform((v) => (v === '' || v === null || v === undefined ? null : Number(v)))
    .refine((v) => v === null || (!Number.isNaN(v) && v >= 0 && v <= 100), {
      message: 'Kolom score harus di antara 0 dan 100.',
    }),
});

export const syncAssessmentSchema = z.object({
  semester: z.string().nullable().optional(),
  source_semester: z.string().nullable().optional(),
});

// ---------------------------------------------------------------- settings

export const updateDeadlineNotificationSchema = z.object({
  deadline_notification: z.string().min(1, 'Kolom deadline notification wajib diisi.'),
});

export const updateNotificationChannelSchema = z.object({
  notification_channel: z.enum(['email', 'telegram', 'both'], {
    message: 'Kolom notification channel yang dipilih tidak valid.',
  }),
});

export const updateTelegramChatIdSchema = z.object({
  telegram_chat_id: z
    .string()
    .max(64, 'Kolom telegram chat id maksimal berisi 64 karakter.')
    .nullable()
    .optional(),
});

export const storeSiakangCredentialsSchema = z.object({
  siakang_email: z.string().email('Kolom siakang email harus berupa alamat email yang valid.'),
  siakang_password: z.string().min(1, 'Kolom siakang password wajib diisi.'),
});

// ---------------------------------------------------------------- grades

export const storeGradeSchema = z.object({
  grade: z.string().min(1, 'Kolom grade wajib diisi.'),
  grade_point: z.coerce.number({ message: 'Kolom grade point harus berupa angka.' }),
  minimal_score: z.coerce
    .number({ message: 'Kolom minimal score harus berupa angka.' })
    .min(0, 'Kolom minimal score minimal berisi 0.')
    .max(100, 'Kolom minimal score maksimal berisi 100.'),
  maximal_score: z.coerce
    .number({ message: 'Kolom maximal score harus berupa angka.' })
    .min(0, 'Kolom maximal score minimal berisi 0.')
    .max(100, 'Kolom maximal score maksimal berisi 100.'),
});

export const updateGradeSchema = storeGradeSchema;

/**
 * Replicates Laravel's `sometimes|boolean` for `priority`: strings "1"/"0",
 * numbers and real booleans are all accepted.
 */
export function toBoolean(value) {
  if (value === undefined || value === null || value === '') return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const normalized = String(value).toLowerCase();
  return ['1', 'true', 'on', 'yes'].includes(normalized);
}
