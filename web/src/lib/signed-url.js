import { createHmac, timingSafeEqual } from 'node:crypto';

// Signed URLs, replacing Laravel's `URL::temporarySignedRoute` / `signed`
// middleware for the email-verification endpoint.
//
// Format: ?expires=<unix>&signature=<hex>
// The signature covers the full path plus the expiry, so a link cannot be
// replayed after it lapses and cannot be pointed at another user.

function key() {
  const secret = process.env.APP_KEY || process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('APP_KEY (or JWT_SECRET) must be set to sign verification URLs.');
  }

  return secret;
}

function sign(payload) {
  return createHmac('sha256', key()).update(payload).digest('hex');
}

/** Build a signed absolute URL for a path, valid for `ttlSeconds`. */
export function temporarySignedUrl(pathname, query = {}, ttlSeconds = 3600) {
  // Laravel's VerifyEmailNotification rewrites the API URL to FRONTEND_URL, so
  // the link the user clicks points at the SPA route, not the API.
  const base = (
    process.env.FRONTEND_URL ||
    process.env.APP_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '');
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;

  const params = new URLSearchParams({ ...query, expires: String(expires) });
  const payload = `${pathname}?${params.toString()}`;
  params.set('signature', sign(payload));

  return `${base}${pathname}?${params.toString()}`;
}

/** Verify `expires` + `signature` against the request path and query. */
export function hasValidSignature(pathname, searchParams) {
  const expires = searchParams.get('expires');
  const signature = searchParams.get('signature');

  if (!expires || !signature) return false;

  if (Number(expires) < Math.floor(Date.now() / 1000)) return false;

  const params = new URLSearchParams(searchParams);
  params.delete('signature');

  const expected = sign(`${pathname}?${params.toString()}`);

  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');

  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}
