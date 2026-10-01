// Manual reminder trigger, replacing `php artisan notifications:reminder`.
//
// Usage: pnpm cron:reminder   (reads .env.local via node --env-file)
//
// Calls the same HTTP endpoint Vercel Cron hits, so a local run behaves
// exactly like the daily schedule.

const base = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
const secret = process.env.CRON_SECRET;

const response = await fetch(`${base}/api/cron/reminder`, {
  headers: secret ? { authorization: `Bearer ${secret}` } : {},
});

const body = await response.json().catch(() => null);

if (!response.ok) {
  console.error(`Reminder run failed (${response.status})`, body);
  process.exit(1);
}

console.log(JSON.stringify(body, null, 2));
