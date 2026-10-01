import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// Replicates Laravel's `encrypted` cast for settings.siakang_email and
// settings.siakang_password.
//
// Laravel encrypts with APP_KEY (AES-256-CBC, payload = base64 of
//   base64(json([iv, value, mac, tag]))  with an HMAC-SHA256 MAC).
// The rows already in Supabase were written by Laravel, so this module can
// decrypt them, and new writes use the same format so the Laravel API keeps
// reading them during the transition.
//
// LARAVEL_APP_KEY must be the SAME value as server/.env APP_KEY, with the
// `base64:` prefix included. Without it, existing Siakang credentials cannot
// be decrypted and users must re-enter them in Settings.

function appKey() {
  const raw = process.env.LARAVEL_APP_KEY;

  if (!raw) {
    throw new Error('LARAVEL_APP_KEY is not set; Siakang credentials cannot be read.');
  }

  const base64 = raw.startsWith('base64:') ? raw.slice(7) : raw;
  const key = Buffer.from(base64, 'base64');

  if (key.length !== 32) {
    throw new Error('LARAVEL_APP_KEY must decode to 32 bytes (AES-256).');
  }

  return key;
}

function macKey() {
  // Illuminate\Encryption\Encrypter::hash() HMACs with the RAW APP_KEY bytes.
  // (An earlier port derived sha256(key[0:16]); that never matched Laravel.)
  return appKey();
}

function macFor(ivB64, valueB64) {
  return createHmac('sha256', macKey())
    .update(ivB64)
    .update(valueB64)
    .digest('hex');
}

/** Encrypt a value the way Laravel's encrypter does. */
export function encrypt(value) {
  if (value === null || value === undefined) return null;

  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', appKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);

  const ivB64 = iv.toString('base64');
  const valueB64 = encrypted.toString('base64');

  return Buffer.from(
    JSON.stringify({ iv: ivB64, value: valueB64, mac: macFor(ivB64, valueB64), tag: '' }),
    'utf8'
  ).toString('base64');
}

/** Decrypt a value written by Laravel (or by encrypt() above). */
export function decrypt(payload) {
  if (payload === null || payload === undefined || payload === '') return null;

  let parsed;

  try {
    parsed = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
  } catch {
    return null;
  }

  if (!parsed?.iv || !parsed?.value || !parsed?.mac) return null;

  const expected = Buffer.from(macFor(parsed.iv, parsed.value), 'utf8');
  const actual = Buffer.from(String(parsed.mac), 'utf8');

  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    // The MAC failed: the ciphertext was written with a different APP_KEY or
    // has been tampered with. Treat as "no credentials" rather than throwing,
    // so a settings page still renders.
    return null;
  }

  try {
    const decipher = createDecipheriv('aes-256-cbc', appKey(), Buffer.from(parsed.iv, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(parsed.value, 'base64')),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}
