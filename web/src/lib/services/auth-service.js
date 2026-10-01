import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/db';
import { ApiError } from '@/lib/api-response';
import { serializeUser } from '@/lib/serialize';

// Port of App\Services\AuthService.
//
// Differences from Laravel:
//   - Sanctum tokens -> httpOnly JWT cookie (see src/lib/auth.js).
//   - The `token` in the JSON body is an opaque marker for the SPA's
//     localStorage UI state; it is NOT the credential. Auth is the cookie.
//   - The database queue has no worker on Vercel, so notifications are sent
//     by an explicit call (see src/lib/notifications.js) instead of a
//     ShouldQueue job.

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 12);

/** Default grade scale created for every new user (matches AuthService). */
const DEFAULT_GRADES = [
  ['A', 4.0, 85, 100],
  ['A-', 3.75, 80, 84.99],
  ['B+', 3.5, 75, 79.99],
  ['B', 3.0, 70, 74.99],
  ['B-', 2.75, 65, 69.99],
  ['C+', 2.5, 60, 64.99],
  ['C', 2.0, 56, 59.99],
  ['D', 1.0, 50, 55.99],
  ['E', 0.0, 0, 49.99],
];

function marker() {
  return randomBytes(32).toString('hex');
}

export async function login(email, password, _rememberMe = false) {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw new ApiError('Email atau kata sandi salah', 401);
  }

  const valid = await bcrypt.compare(password, user.password);

  if (!valid) {
    throw new ApiError('Email atau kata sandi salah', 401);
  }

  return {
    token: marker(),
    token_type: 'Bearer',
    user: serializeUser(user),
  };
}

export async function register({ name, email, password }) {
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    // RegisterRequest uses Rule::unique('users','email'), whose default message
    // is English (no lang/id translation files ship with the app).
    throw new ApiError('The email has already been taken.', 422, {
      email: ['The email has already been taken.'],
    });
  }

  const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const now = new Date();

  // Mirrors AuthService::register: user + default setting + 9 grade rows in
  // one transaction.
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name,
        email,
        password: hashed,
        created_at: now,
        updated_at: now,
      },
    });

    await tx.setting.create({
      data: {
        user_id: created.id,
        deadline_notification: '5 hari lagi',
        task_created_notification: true,
        task_completed_notification: true,
        notification_channel: 'email',
      },
    });

    await tx.grade.createMany({
      data: DEFAULT_GRADES.map(([grade, point, min, max]) => ({
        user_id: created.id,
        grade,
        grade_point: point,
        minimal_score: min,
        maximal_score: max,
      })),
    });

    return created;
  });

  return {
    token: marker(),
    token_type: 'Bearer',
    user: serializeUser(user),
  };
}

/** Token marker check. The real session lives in the cookie. */
export function checkToken() {
  return { valid: true };
}

export function checkEmailVerified(user) {
  return { verified: user.email_verified_at !== null };
}

/** Issue a signed verification link. Returns null when already verified. */
export async function buildVerificationUrl(user) {
  if (user.email_verified_at) return null;

  const { temporarySignedUrl } = await import('@/lib/signed-url');
  const { createHash } = await import('node:crypto');

  // Mirrors VerifyEmailNotification: Laravel builds the signed API URL and
  // rewrites `/api` to FRONTEND_URL `/auth`, so the emailed link points at the
  // SPA route and carries the same expires+signature query. `hash` is
  // sha1(email), exactly like Laravel's VerifyEmail notification.
  const frontend = (
    process.env.FRONTEND_URL ||
    process.env.APP_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '');
  const hash = createHash('sha1').update(user.email).digest('hex');
  const apiPath = `/api/email/verify/${user.id}/${hash}`;
  const signed = temporarySignedUrl(apiPath, {}, 3600);
  const query = signed.slice(signed.indexOf('?'));

  return `${frontend}/auth/email/verify/${user.id}/${hash}${query}`;
}

export async function verifyEmail(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    throw new ApiError('Pengguna tidak ditemukan', 202);
  }

  if (user.email_verified_at) {
    throw new ApiError('Email sudah diverifikasi', 202);
  }

  await prisma.user.update({
    where: { id: userId },
    data: { email_verified_at: new Date() },
  });

  return true;
}

export { marker };
