import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendReminderDigest } from '@/lib/services/notification-service';

// GET /api/cron/reminder
//
// Vercel Cron entry point, replacing the systemd `schedule:work` service that
// ran `notifications:reminder` daily at 07:00 Asia/Jakarta.
//
// Schedule is declared in vercel.json as "0 0 * * *" (UTC) = 07:00 WIB.
// Vercel sends `Authorization: Bearer $CRON_SECRET`, which is verified here so
// the endpoint cannot be triggered by third parties.
//
// Note: on the Hobby plan Vercel may delay a cron by up to an hour.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request) {
  const secret = process.env.CRON_SECRET;

  // Fail closed in production: without the secret, anyone could trigger a
  // reminder blast. Locally (no Vercel) an unset secret keeps it runnable.
  if (!secret) {
    if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
      return NextResponse.json({ message: 'Cron is not configured.' }, { status: 503 });
    }
  } else {
    const authorization = request.headers.get('authorization');

    if (authorization !== `Bearer ${secret}`) {
      return NextResponse.json({ message: 'Unauthenticated.' }, { status: 401 });
    }
  }

  // Laravel iterated every Setting row (not only verified users): a user who
  // never verified still has preferences and tasks.
  const settings = await prisma.setting.findMany({ select: { user_id: true } });

  let delivered = 0;
  let skipped = 0;
  const failures = [];

  for (const setting of settings) {
    try {
      const { count } = await sendReminderDigest(setting.user_id);

      if (count > 0) delivered += 1;
      else skipped += 1;
    } catch (error) {
      failures.push({ user_id: Number(setting.user_id), error: error.message });
    }
  }

  return NextResponse.json({
    code: 200,
    message: 'Reminder dijalankan',
    data: { users: settings.length, delivered, skipped, failures },
  });
}
