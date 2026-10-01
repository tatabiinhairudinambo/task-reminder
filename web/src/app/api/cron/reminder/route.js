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

export async function GET(request) {
  const secret = process.env.CRON_SECRET;

  if (secret) {
    const authorization = request.headers.get('authorization');

    if (authorization !== `Bearer ${secret}`) {
      return NextResponse.json({ message: 'Unauthenticated.' }, { status: 401 });
    }
  }

  const users = await prisma.user.findMany({
    where: { email_verified_at: { not: null } },
    select: { id: true },
  });

  let delivered = 0;
  let skipped = 0;
  const failures = [];

  for (const user of users) {
    try {
      const { count } = await sendReminderDigest(user.id);

      if (count > 0) delivered += 1;
      else skipped += 1;
    } catch (error) {
      failures.push({ user_id: Number(user.id), error: error.message });
    }
  }

  return NextResponse.json({
    code: 200,
    message: 'Reminder dijalankan',
    data: { users: users.length, delivered, skipped, failures },
  });
}
