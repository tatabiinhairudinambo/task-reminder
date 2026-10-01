import { NextResponse } from 'next/server';

// Rate limiting for the auth endpoints, replacing Laravel's `throttle` route
// middleware:
//
//   POST /api/auth/login, /api/auth/register    -> 10 per minute
//   POST /api/password/email, /password/reset   ->  5 per minute
//   POST /api/email/resend                      ->  6 per minute
//
// Laravel keys the limiter by client IP + route; the same is done here with an
// in-memory sliding window. On a multi-instance deployment each instance keeps
// its own window (the same trade-off as Laravel's array cache), which is still
// enough to stop brute-force attempts.

const WINDOWS = new Map();

const RULES = [
  { path: '/api/auth/login', limit: 10 },
  { path: '/api/auth/register', limit: 10 },
  { path: '/api/password/email', limit: 5 },
  { path: '/api/password/reset', limit: 5 },
  { path: '/api/email/resend', limit: 6 },
];

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const rule = RULES.find((r) => r.path === pathname);

  if (!rule) return NextResponse.next();

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  const key = `${rule.path}:${ip}`;
  const now = Date.now();
  const windowStart = now - 60_000;

  const hits = (WINDOWS.get(key) ?? []).filter((time) => time > windowStart);
  hits.push(now);
  WINDOWS.set(key, hits);

  // Keep the map from growing without bound.
  if (WINDOWS.size > 10_000) {
    for (const [entryKey, times] of WINDOWS) {
      if (!times.some((time) => time > windowStart)) WINDOWS.delete(entryKey);
    }
  }

  if (hits.length > rule.limit) {
    return NextResponse.json(
      { message: 'Too Many Requests' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/auth/login',
    '/api/auth/register',
    '/api/password/email',
    '/api/password/reset',
    '/api/email/resend',
  ],
};
