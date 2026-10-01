import path from 'node:path';
import { defineConfig } from 'prisma/config';

// Prisma 7 moved connection URLs out of schema.prisma and into this file.
//
// Vercel/Supabase specifics:
//   DATABASE_URL - pooled connection (PgBouncer, port 6543 in "transaction"
//                  mode) used at runtime by the app.
//   DIRECT_URL   - direct connection (port 5432) used by the CLI for
//                  introspection / migrations, which cannot run through the
//                  transaction pooler.
//
// Locally, both may be the same URL. `.env.local` is loaded by Next itself;
// the CLI reads `.env` here so `pnpm db:push` works from a fresh clone.
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  datasource: {
    url: process.env.DATABASE_URL,
    directUrl: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
});
