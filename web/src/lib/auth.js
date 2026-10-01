import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { prisma } from '@/lib/db';

// Auth replaces Sanctum bearer tokens with an httpOnly JWT cookie.
//
// Why not Bearer tokens in localStorage? On Vercel the SPA and the API are the
// same origin, so a cookie is both simpler and safer (no XSS exfiltration).
// The SPA's axios interceptor reads `import.meta.env.VITE_API_URL` and sends an
// Authorization header when a token is present - see the migration notes in
// README for the one-line change needed there.
//
// Token lifetimes mirror the Laravel service:
//   remember_me = true  -> 30 days
//   otherwise           -> 1 hour  (refreshed on every authenticated request)

const COOKIE_NAME = 'tr_token';
const REMEMBER_SECONDS = 60 * 60 * 24 * 30;
const DEFAULT_SECONDS = 60 * 60;

function secretKey() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET is not set. Generate one with `openssl rand -base64 32`.');
  }

  return new TextEncoder().encode(secret);
}

/** Sign a session token for a user id. */
export async function signSession(userId, remember = false) {
  const maxAge = remember ? REMEMBER_SECONDS : DEFAULT_SECONDS;

  const token = await new SignJWT({ sub: String(userId) })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${maxAge}s`)
    .sign(secretKey());

  return { token, maxAge };
}

/** Verify a token and return the user id, or null when invalid/expired. */
export async function verifySession(token) {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secretKey());
    const id = payload.sub;

    return id ? BigInt(id) : null;
  } catch {
    return null;
  }
}

/** Set the session cookie. Called from route handlers. */
export async function setSessionCookie(userId, remember = false) {
  const { token, maxAge } = await signSession(userId, remember);
  const store = await cookies();

  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge,
  });

  return token;
}

/** Clear the session cookie. */
export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/**
 * Resolve the authenticated user from the request cookie.
 * Returns the full user row, or null when unauthenticated.
 */
export async function currentUser() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  const userId = await verifySession(token);

  if (!userId) return null;

  return prisma.user.findUnique({ where: { id: userId } });
}

/** Same as currentUser() but throws a 401-shaped error when missing. */
export async function requireUser() {
  const user = await currentUser();

  if (!user) {
    const error = new Error('Unauthenticated.');
    error.status = 401;
    throw error;
  }

  return user;
}

/** Same as requireUser() but also enforces a verified email (`verified` middleware). */
export async function requireVerifiedUser() {
  const user = await requireUser();

  if (!user.email_verified_at) {
    const error = new Error('Your email address is not verified.');
    error.status = 403;
    throw error;
  }

  return user;
}

export { COOKIE_NAME };
