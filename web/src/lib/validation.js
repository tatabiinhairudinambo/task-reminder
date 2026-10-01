import { z } from 'zod';

// Zod ports of the 20 Laravel Form Requests.
//
// Messages are byte-for-byte the English defaults Laravel emits: APP_LOCALE is
// `id` but the app ships no lang/id translation files, so the validator falls
// back to the English message keys (verified with a bootstrap probe against
// server/.env). Every `authorize()` in Laravel returned `true`; ownership is
// enforced in the service layer with `where user_id`, which these routes
// replicate.

// Laravel validator message formats.
const required = (field) => `The ${field} field is required.`;
const emailMsg = (field) => `The ${field} field must be a valid email address.`;
const stringMsg = (field) => `The ${field} field must be a string.`;
const minChars = (field, n) => `The ${field} field must be at least ${n} characters.`;
const maxChars = (field, n) => `The ${field} field must not be greater than ${n} characters.`;
const minNumber = (field, n) => `The ${field} field must be at least ${n}.`;
const maxNumber = (field, n) => `The ${field} field must not be greater than ${n}.`;
const integerMsg = (field) => `The ${field} field must be an integer.`;
const numberMsg = (field) => `The ${field} field must be a number.`;
const booleanMsg = (field) => `The ${field} field must be true or false.`;
const dateMsg = (field) => `The ${field} field must be a valid date.`;
const sameMsg = (field, other) => `The ${field} field must match ${other}.`;
const selectedMsg = (field) => `The selected ${field} is invalid.`;

/** `required|string` */
const str = (field) => z.string({ message: stringMsg(field) }).min(1, required(field));
/** `nullable|string` */
const nullableStr = (field) => z.string({ message: stringMsg(field) }).nullable();
/** `required|email` */
const emailStr = (field) => str(field).email(emailMsg(field));

/**
 * `boolean`: Laravel accepts only [true, false, 1, 0, "1", "0"].
 * Any other value produces "The <field> field must be true or false."
 */
const booleanLike = (field) =>
  z.union(
    [z.boolean(), z.literal(0), z.literal(1), z.literal('0'), z.literal('1')],
    { message: booleanMsg(field) }
  );

/**
 * `required|date`: Laravel's date rule accepts anything strtotime() can parse;
 * a JS Date parse is the closest equivalent. Rejects "not-a-date" with a 422
 * instead of letting Prisma throw a 500.
 */
const dateLike = (field) =>
  str(field).refine((v) => !Number.isNaN(new Date(v).getTime()), dateMsg(field));

// ---------------------------------------------------------------- auth

export const loginSchema = z.object({
  email: emailStr('email'),
  password: str('password'),
  remember_me: booleanLike('remember_me').optional(),
});

export const registerSchema = z
  .object({
    name: str('name'),
    email: emailStr('email'),
    password: z
      .string({ message: stringMsg('password') })
      .min(8, minChars('password', 8)),
    password_confirmation: str('password confirmation'),
  })
  .refine((data) => data.password === data.password_confirmation, {
    message: sameMsg('password confirmation', 'password'),
    path: ['password_confirmation'],
  });

export const sendResetLinkSchema = z.object({
  email: emailStr('email'),
});

export const resetPasswordSchema = z
  .object({
    email: emailStr('email'),
    token: str('token'),
    password: z
      .string({ message: stringMsg('password') })
      .min(8, minChars('password', 8)),
    password_confirmation: str('password confirmation'),
  })
  .refine((data) => data.password === data.password_confirmation, {
    message: sameMsg('password confirmation', 'password'),
    path: ['password_confirmation'],
  });

// ---------------------------------------------------------------- user

export const updateProfileSchema = z.object({
  name: str('name'),
  email: emailStr('email'),
});

export const changePasswordSchema = z
  .object({
    old_password: str('old password'),
    password: z
      .string({ message: stringMsg('password') })
      .min(8, minChars('password', 8)),
    password_confirmation: str('password confirmation'),
  })
  .refine((data) => data.password === data.password_confirmation, {
    message: sameMsg('password confirmation', 'password'),
    path: ['password_confirmation'],
  });

// ---------------------------------------------------------------- tasks

export const storeTaskSchema = z.object({
  task: str('task'),
  description: nullableStr('description').optional(),
  deadline: dateLike('deadline'),
  priority: booleanLike('priority').optional(),
  // `exists:course_contents,id` cannot be expressed in Zod; the route checks
  // the row first and returns Laravel's 422 when it is missing.
  course_content_id: z.union([z.number(), z.string()], {
    message: required('course content id'),
  }),
});

export const updateTaskSchema = storeTaskSchema;

// ---------------------------------------------------------------- course contents

export const storeCourseContentSchema = z.object({
  semester: str('semester'),
  code: str('code'),
  course_content: str('course content'),
  credits: z.coerce
    .number({ message: integerMsg('credits') })
    .int(integerMsg('credits'))
    .min(1, minNumber('credits', 1)),
  lecturer: str('lecturer'),
  day: str('day'),
  hour_start: str('hour start'),
  hour_end: str('hour end'),
});

export const updateCourseContentSchema = storeCourseContentSchema;

export const clearSemesterSchema = z.object({
  semester: str('semester'),
});

export const syncScheduleSchema = z.object({
  semester: str('semester'),
  source_semester: nullableStr('source semester').optional(),
});

// ---------------------------------------------------------------- assessment

export const updateAssessmentSchema = z.object({
  // `nullable|numeric|min:0|max:100`; a missing key means "clear the score".
  score: z
    .union([z.number(), z.string(), z.null()])
    .optional()
    .transform((v) => (v === null || v === undefined || v === '' ? null : Number(v)))
    .refine((v) => v === null || !Number.isNaN(v), { message: numberMsg('score') })
    .refine((v) => v === null || v >= 0, { message: minNumber('score', 0) })
    .refine((v) => v === null || v <= 100, { message: maxNumber('score', 100) }),
});

export const syncAssessmentSchema = z.object({
  semester: nullableStr('semester').optional(),
  source_semester: nullableStr('source semester').optional(),
});

// ---------------------------------------------------------------- settings

export const updateDeadlineNotificationSchema = z.object({
  deadline_notification: str('deadline notification'),
});

export const updateNotificationChannelSchema = z.object({
  notification_channel: str('notification channel').refine(
    (v) => ['email', 'telegram', 'both'].includes(v),
    { message: selectedMsg('notification channel') }
  ),
});

export const updateTelegramChatIdSchema = z.object({
  telegram_chat_id: z
    .string({ message: stringMsg('telegram chat id') })
    .max(64, maxChars('telegram chat id', 64))
    .nullable()
    .optional(),
});

export const storeSiakangCredentialsSchema = z.object({
  siakang_email: emailStr('siakang email'),
  siakang_password: str('siakang password'),
});

// ---------------------------------------------------------------- grades

export const storeGradeSchema = z.object({
  grade: str('grade'),
  grade_point: z.coerce.number({ message: numberMsg('grade point') }),
  minimal_score: z.coerce
    .number({ message: numberMsg('minimal score') })
    .min(0, minNumber('minimal score', 0))
    .max(100, maxNumber('minimal score', 100)),
  maximal_score: z.coerce
    .number({ message: numberMsg('maximal score') })
    .min(0, minNumber('maximal score', 0))
    .max(100, maxNumber('maximal score', 100)),
});

export const updateGradeSchema = storeGradeSchema;

/**
 * Replicates Laravel's `boolean` rule for `priority` *after* validation has
 * passed: "1"/1/true -> true, everything else (including "0"/0/false) -> false.
 * Invalid values are rejected by `booleanLike` before this runs.
 */
export function toBoolean(value) {
  if (value === undefined || value === null || value === '') return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  return ['1', 'true'].includes(String(value).toLowerCase());
}
