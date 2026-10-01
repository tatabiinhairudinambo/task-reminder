## Project

Monorepo:
- `web/` — **active app**: Next.js 16 App Router (UI + API route handlers) + Prisma 7 + Vitest
- `client/` — legacy React 19 + Vite SPA (pnpm) + Vitest
- `server/` — legacy Laravel 13 API + Octane (FrankenPHP) + Pest tests

`web/` replaces both `client/` (UI) and `server/` (API) against the **same Supabase database**; during the transition `server/` can still read rows `web/` wrote (crypto, password-reset token hashes, time formats and validation messages are byte-compatible).

## Commands

```bash
# Active app
cd web && pnpm dev              # http://localhost:3000 (UI + /api/*)
cd web && pnpm build            # prisma generate + next build
cd web && pnpm lint
cd web && pnpm test             # Vitest + jsdom

# Manual reminder trigger (same endpoint Vercel Cron hits)
cd web && pnpm cron:reminder

# Legacy (still runnable)
cd server && composer run dev   # API :8000 + queue + pail logs
cd client && pnpm dev           # React SPA :5173
```

```bash
# Legacy tests
cd server && php artisan test --filter=MyTest
cd server && php artisan test --testsuite=Feature
cd client && pnpm test
```

## Architecture (web/)

- **Route handlers**: `web/src/app/api/**/route.js` mirror every Laravel endpoint 1:1 (same verbs, status codes, `{code,message,data}` envelope via `src/lib/api-response.js`).
- **Services**: `web/src/lib/services/*.js` are ports of `server/app/Services/*`; Prisma is the data layer (`src/lib/db.js`).
- **Validation**: `web/src/lib/validation.js` (Zod) ports the 20 Form Requests. Messages are the English Laravel defaults (the app ships no `lang/id` files), including `exists:course_contents` as a 422 in the task routes.
- **Auth**: httpOnly JWT cookie (`src/lib/auth.js`) replaces Sanctum tokens; `requireVerifiedUser()` replaces `auth:sanctum` + `verified`. Rate limits from `server/routes/api.php` are enforced in `web/middleware.js` (10/min auth, 5/min password, 6/min resend).
- **Reminders**: `/api/cron/reminder` + `vercel.json` (07:00 WIB) select tasks by `setting.deadline_notification` date OR today OR tomorrow OR priority, then sort priority-first — same as `SendReminderEmailNotifications`.
- **Crypto**: `src/lib/crypto.js` implements Laravel's encrypter (AES-256-CBC + HMAC with the raw APP_KEY, `encrypt($v, false)` = no PHP serialize). Requires `LARAVEL_APP_KEY` = `server/.env APP_KEY`.
- **Password reset tokens**: stored bcrypt-hashed like Laravel's broker; 60-minute expiry and 60-second resend throttle.
- **Email/Telegram**: inline sends (no queue on Vercel). Email templates are HTML ports of `server/resources/views/emails/*`; Telegram MarkdownV2 chunking is unchanged.
- **react-router shim**: `react-router-dom` aliases to `src/lib/react-router-dom.jsx` (Next App Router), so the ported components keep their imports.

## Architecture (legacy server/)

- **Controller → Service**: Controllers in `app/Http/Controllers/` delegate to services in `app/Services/`. All controllers use the `ApiResponse` trait for JSON responses.
- **Validation**: All request validation lives in `app/Http/Requests/` Form Requests (20 classes), controllers use `$request->validated()` only. See `StoreTaskRequest`, `UpdateGradeRequest` etc for `authorize` and `rules`.
- **Routes**: Standard CRUD uses `apiResource` (`server/routes/api.php:45,54,69`) for `course-contents`, `tasks`, `settings/grades`, custom routes are defined before the resource to avoid `{id}` collision. Non CRUD like `filter`, `sync-schedule` stays manual.
- **Task parent ownership**: `TaskService::update` re-scopes the new `course_content_id` to the caller (`where user_id ... firstOrFail`), mirroring `create`, so cross-owner reparenting fails 404 without revealing parent existence.
- **Email change reverification**: `UserService::updateProfile` clears `email_verified_at` and resends verification when the email changes; same-email updates keep the verified flag.
- **Sanctum SPA auth**: Most API routes require `auth:sanctum` + `verified` middleware (`server/routes/api.php:32`). Auth routes are rate-limited (`throttle:10,1`).
- **Queue**: Database driver. Non-test notifications (email + Telegram) use `ShouldQueue`. Must run a queue worker for delivery; test notifications are synchronous and need no worker.
- **Reminder schedule**: `notifications:reminder` runs daily at 07:00 app time (`server/routes/console.php`) with `withoutOverlapping`. `php artisan schedule:run` (cron) or `schedule:work` must be running for automatic delivery.
- **Telegram message limit**: `TelegramService::buildReminderSummaryMessages()` splits a digest into ≤4096-character messages (Telegram rejects longer ones); `TelegramChannel` sends each chunk in order and `ReminderNotification::toTelegram()` returns `string|array`. Deadlines must stay ISO (`toDateString()`) in the queued payload — `translatedFormat('j F Y')` is applied at render time, since Carbon cannot parse an Indonesian month name.
- **Notifications**: non-test notifications (`TaskCreatedNotification`, `TaskCompletedNotification`, `ReminderNotification`) are `ShouldQueue` and send via `mail` + custom `TelegramChannel` (MarkdownV2). Channels resolve per user `Setting` via `ResolvesNotificationChannels::channelsFor()` and chat ID via `User::routeNotificationForTelegram()`. Test notification (`TestNotification`, sync mail + sync Telegram via `TelegramService`) gives immediate success/failure feedback via `SettingsController::testNotification`.

## Testing

```bash
cd server && php artisan test                 # 286 tests (Feature + Unit)
cd client && pnpm test                        # 123 tests Vitest + jsdom
```

- **Server**: **Pest** (not bare PHPUnit), 286 tests. All `Feature` tests automatically use `RefreshDatabase` trait (`server/tests/Pest.php:14`). Testing DB defaults to PostgreSQL/Supabase — database `task_reminder_pg_test`, host/credentials inherited from `.env` (`server/phpunit.xml:27`). That database must exist before running tests; create it once with `CREATE DATABASE task_reminder_pg_test` (Supabase role has `CREATEDB`). To run against MySQL instead: `DB_CONNECTION=mysql DB_DATABASE=task_reminder_test php artisan test`. Test env sets `QUEUE_CONNECTION=sync` and `MAIL_MAILER=array`. Feature tests match API route groups: Auth, Task, CourseContent, Assessment, Dashboard, Grade, Settings, PasswordReset, User. Unit tests cover services one-to-one plus `RequestValidationTest` (20 Form Requests), `ModelTest` (Setting, Task deadline_label/deadlineBadgeColor, relations), `TelegramChannelTest`, and `ReminderNotificationTest`. Cross-owner regression coverage: task update rejects a foreign `course_content_id` (Unit + Feature), profile email change clears `email_verified_at` and resends verification (Unit + Feature).
- **Client**: **Vitest** 4 + `jsdom` + `@testing-library/react` + `jest-dom`. Config in `client/vite.config.js:13` (`environment: jsdom`, `setupFiles: src/test/setup.js`). Tests cover `src/lib/` (utils, constants, formUtils, tableUtils, scheduleUtils), `src/store/useSemesterStore`, `src/api/` (axiosInstance interceptors + 9 api modules), `src/hooks/` (useModal, useAuth, useChartData, useSemesterOverview, useGrades, useCourseContents, useDashboard, useAssessments, useSettings).

## Client conventions

- **Package manager**: pnpm (not npm/yarn).
- **shadcn/ui**: New York style, JSX (no TypeScript), Lucide icons. UI components in `src/components/ui/` are ESLint-ignored auto-generated code.
- **State**: Zustand store `useSemesterStore` for semester ID persistence across pages.
- **API**: Axios instance in `src/api/axiosInstance.js` — reads `VITE_API_URL` from env.
- **Auth flow**: login reads the verified flag from `data.verified` (`checkEmail`) and routes unverified users to `/auth/verify-email`; the login request uses `skipAuthLogout` so failed-login toasts survive the global 401 redirect. After a profile email change, `updateProfile` syncs localStorage and `ProfileForm` navigates to `/auth/verify-email`.
- **Routing**: React Router with code-split lazy pages. All protected pages wrap in `<ProtectedRoute>`.
- **Alias**: `@/` → `src/` (vite + jsconfig).
- **Testing**: Vitest + jsdom. Run `pnpm test` from `client/`. Setup file `src/test/setup.js` mocks `matchMedia` and storage.

## Env vars

**Client** (`client/.env`):
- `VITE_BASE_URL` — backend origin (default `http://localhost:8000`)
- `VITE_API_URL` — computed as `${VITE_BASE_URL}/api`

**Server** (`server/.env`):
- `DB_DATABASE` — MySQL database name
- `QUEUE_CONNECTION=database`
- `FRONTEND_URL` — CORS/origin for Sanctum (default `http://localhost:5173`)
- `TELEGRAM_BOT_TOKEN` — required for Telegram notifications
- `SIAKANG_UV` — optional absolute path to `uv` for the bridge; set on servers where Octane/FrankenPHP has a restricted PATH (defaults to `/root/.local/bin/uv`)
- `DB_SSLMODE` — PostgreSQL TLS mode; set to `require` for Supabase (default `prefer`)
- `APP_TIMEZONE` — set to `Asia/Jakarta`. The default `UTC` mislabels tasks due *today* as "1 hari lagi" between 00:00–07:00 WIB, because `Task::getDeadlineLabelAttribute` compares calendar days.

## Database portability (MySQL / PostgreSQL)

The app runs on both MySQL and PostgreSQL (Supabase). Keep these patterns when editing:

- **Boolean columns** (`tasks.status`, `tasks.priority`, `settings.task_created_notification`, `settings.task_completed_notification`) are `boolean` in Postgres. They are cast to `integer` in `Task`/`Setting` models so the API always returns `0`/`1` — do not remove those casts, and never compare them with `=== 1` server-side without casting.
- **No MySQL-only SQL.** `sum(status = 1)` fails on Postgres; use `case when` (`DashboardService::getDashboard`). Existing `CASE LOWER(day)` / `CASE grade` raw orderings are portable — keep them that way.
- **Alias casing:** Postgres lowercases unquoted aliases (`totalTask` → `totaltask`). Use `snake_case` aliases.
- **Sanctum tokens:** resolve with `PersonalAccessToken::findToken($plainTextToken)`, never by querying `id` with the raw `id|secret` string.
- Tests default to Supabase/Postgres: `php artisan test` (uses `task_reminder_pg_test`). MySQL still works: `DB_CONNECTION=mysql DB_DATABASE=task_reminder_test php artisan test`. Setup guide: `PANDUAN-SUPABASE.md`.

## Deployment (web/ on Vercel)

`web/` deploys to Vercel from this repo with **Root Directory = `web`** (Project → Settings → General). `web/vercel.json` pins `regions: ["icn1"]` (Seoul, next to the Supabase `ap-northeast-2` pooler) and declares the daily cron.

1. Import the GitHub repo at vercel.com → set Root Directory to `web` → Framework preset: Next.js. `pnpm install` runs automatically (lockfile v9, pnpm 11 via `packageManager`); `allowBuilds` in `web/pnpm-workspace.yaml` lets Prisma's engines postinstall run.
2. Add the env vars from `web/.env.example` in Project → Settings → Environment Variables. Required: `DATABASE_URL` (Supabase **transaction pooler**, port 6543, `sslmode=require`), `DIRECT_URL` (port 5432, for the Prisma CLI), `JWT_SECRET`, `LARAVEL_APP_KEY` (exact `server/.env APP_KEY`), `APP_URL` + `FRONTEND_URL` (the production domain), `CRON_SECRET`. Optional: `TELEGRAM_BOT_TOKEN`, `RESEND_API_KEY` + `MAIL_PROVIDER=resend` + `MAIL_FROM_ADDRESS`, `SIAKANG_BRIDGE_URL`, `APP_TIMEZONE`.
3. Deploy. Without `CRON_SECRET` the cron route answers 503 in production (fail closed); with it, Vercel Cron sends `Authorization: Bearer $CRON_SECRET` daily at `0 0 * * *` UTC = 07:00 WIB.
4. **Siakang features need a separate bridge host**: a serverless function cannot run the Python venv. Point `SIAKANG_BRIDGE_URL` at an HTTP service exposing `server/siakang-sync`'s JSON contract (`POST /run`), or leave it empty and those four routes answer with an actionable error.
5. `LARAVEL_APP_KEY` is load-bearing for parity: it must equal `server/.env APP_KEY` so rows encrypted by (or for) the Laravel app decrypt correctly, otherwise `siakangCredentialsOf()` returns null and users must re-enter credentials.
6. Hobby plan cron may be delayed up to an hour; Pro/Enterprise run it on time. Hobby function max duration is 300s — the Siakang routes request 120s (`maxDuration`), well within it.

## Deployment (legacy single domain, server/ + client/)

Production runs on **one domain** (`task.attaambo.dev`) from a single Oracle Cloud VM: Octane/FrankenPHP serves `/api/*` via Laravel and everything else from the pre-built SPA in `server/public/`. No CORS setup, no separate frontend host. Cloudflare Tunnel exposes it (TLS terminated by Cloudflare), so `trustProxies` is enabled when `APP_ENV=production` (`server/bootstrap/app.php`).

```bash
sudo bash server/deploy/setup-oracle.sh      # once: PHP, Node, uv, FrankenPHP, cloudflared
bash server/deploy/deploy.sh                 # build SPA + migrate + caches + restart
sudo bash server/deploy/install-services.sh  # systemd: octane, queue, scheduler
```

- **`server/deploy/Caddyfile`** — SPA + API in one server. The `@laravel` matcher (`/api/* /up /sanctum/* /storage/*`) goes to the Octane worker; every other path falls back to `index.html` so SPA deep links do not 404. Do not replace it with Octane's default stub.
- **`deploy/deploy.sh`** copies `client/dist` into `server/public/` but must **not** overwrite `public/.htaccess` (Laravel's front controller) with the SPA's Apache file. It refuses to run without an `APP_KEY`, skips units that `install-services.sh` has not created yet, and resolves `uv` from `SIAKANG_UV`/`~/.local/bin` instead of assuming it is on PATH.
- **Versions are load-bearing**: `composer.lock` pins Symfony 8 → **PHP >= 8.4.1** (enforced by `vendor/composer/platform_check.php`), and pnpm 11 / Vite 8 need **Node >= 22.13**. `setup-oracle.sh` installs PHP 8.4 + Node 22; do not lower `PHP_VERSION` or `NODE_MAJOR` there.
- **`uv` path**: `setup-oracle.sh` writes `/etc/sudoers.d/task-reminder-deploy` so the app user can restart the three units without a password (otherwise `deploy.sh` hangs on a sudo prompt). `SIAKANG_UV` in `.env` must point at the app user's uv (`/home/ubuntu/.local/bin/uv`), not root's.
- **`SIAKANG_UV` is read via `config('services.siakang.uv')`**, never `env()` — after `config:cache` (the production deploy always caches) Laravel stops loading `.env`, so a bare `env()` call silently returns null.
- **Systemd services must stay enabled**: `task-reminder-queue` delivers notifications (they are queued) and `task-reminder-scheduler` fires the 07:00 reminder. Without them the app works but sends nothing.
- **FrankPHP ships every extension the app needs** (`pdo_pgsql`, `intl`, `gd`, `zip` for Excel, `mbstring`, `bcmath`), so the API does not depend on the system PHP build.
- Full guide: `server/deploy/README.md`.

## Siakang sync (Python bridge)

Laravel shells out to a small Python CLI at `server/siakang-sync/run.py` to pull grades/schedule from Siakang via the `siakang-scrapling` library. Communication is JSON over stdin/stdout.

- **Bridge**: `server/siakang-sync/run.py` — reads a JSON command from stdin, writes `{code, message, data}` to stdout. Always exits `0` for valid commands (HTTP-like status rides in `code`); non-zero only for hard process failures.
- **Invoker**: `app/Services/SiakangClient.php` — `Process` facade, sends payload via `->input()`. Prefers `.venv/bin/python` (no runtime `uv` dependency), falls back to `uv run`.
- **Setup**: `cd server/siakang-sync && uv sync --locked` (Python 3.11+). `uv.lock` is committed so the pinned `siakang-scrapling` revision is reproducible on the VM; only `.venv/` and `.siakang_session_*.json` are gitignored.
- **Session cache**: `session_file=True` everywhere except `verify`, which forces a fresh login so a wrong password isn't masked by a cached session.
- **Details**: the schedule bridge uses `get_detail(schedule_id, tab_keys=[])` (header-only) fetched in parallel — only `kelas` + `dosen` are needed, not all tabs.
- **Credentials**: stored encrypted in `settings.siakang_email`/`settings.siakang_password` (`encrypted` cast, hidden from JSON). `SettingsService::updateSiakangCredentials` validates via Siakang before persisting; a 401 here must NOT be treated as an app-logout.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
