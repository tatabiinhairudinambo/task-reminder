import { PrismaClient } from '@/generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';

// A single PrismaClient per process. Next's dev server hot-reloads modules on
// every edit, so without the global cache each reload would open a new pool
// and exhaust Supabase's connection limit.
//
// Prisma 7 requires an explicit driver adapter. `@prisma/adapter-pg` wraps
// node-postgres and is given the pooled Supabase connection string
// (DATABASE_URL). The CLI uses DIRECT_URL for introspection/migrations, which
// cannot run through PgBouncer's transaction pooler.
//
// The client is created lazily on first query: Next imports route modules
// while collecting page data at build time, and a top-level `new PrismaClient`
// would abort the build when DATABASE_URL is absent (CI, a fresh clone).
const globalForPrisma = globalThis;

function createClient() {
  const raw = process.env.DATABASE_URL;

  if (!raw) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.');
  }

  // Parity with Laravel: libpq's `sslmode=require` encrypts but does NOT verify
  // the CA chain, so the self-signed chain Supabase's pooler presents is
  // accepted. node-postgres (via the driver adapter) verifies by default and
  // fails with "self-signed certificate in certificate chain".
  //
  // pg's connection-string parser turns `sslmode` into an `ssl` object and
  // would override any `ssl` we pass, so the parameter is removed for the
  // non-verifying modes and replaced with an explicit config.
  const url = new URL(raw);
  const sslmode = url.searchParams.get('sslmode');

  let ssl;

  if (sslmode === 'disable') {
    ssl = false;
  } else if (sslmode === 'verify-ca' || sslmode === 'verify-full') {
    ssl = undefined; // leave the URL untouched; pg verifies the chain
  } else {
    // prefer / require / unset -> libpq-equivalent, no chain verification
    url.searchParams.delete('sslmode');
    ssl = { rejectUnauthorized: false };
  }

  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString: url.toString(),
      ...(ssl === undefined ? {} : { ssl }),
    }),
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

function client() {
  if (!globalForPrisma.__taskReminderPrisma) {
    globalForPrisma.__taskReminderPrisma = createClient();
  }

  return globalForPrisma.__taskReminderPrisma;
}

// Property access is proxied so importing this module never connects; the
// first `prisma.user.findMany()` (etc.) is what instantiates the adapter.
export const prisma = new Proxy(
  {},
  {
    get(_target, property) {
      const value = client()[property];
      return typeof value === 'function' ? value.bind(client()) : value;
    },
  }
);
