import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { requireVerifiedUser } from '@/lib/auth';
import { sendError, route } from '@/lib/api-response';

// GET /api/course-contents/download-template
//
// Serves the XLSX template that ships with the repo. In Laravel it lived in
// server/public/templates; it is copied into web/public so Next can serve it
// in production too.

export const GET = route(async () => {
  await requireVerifiedUser();

  const file = path.join(process.cwd(), 'public', 'templates', 'course_content_template.xlsx');

  try {
    const bytes = await readFile(file);

    return new Response(bytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="course_content_template.xlsx"',
      },
    });
  } catch {
    return sendError('File template tidak ditemukan', 404);
  }
});
