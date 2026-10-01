import { requireVerifiedUser } from '@/lib/auth';
import { update, remove } from '@/lib/services/task-service';
import { sendResponse, sendValidationError, route } from '@/lib/api-response';
import { updateTaskSchema } from '@/lib/validation';
import { prisma } from '@/lib/db';

// PUT|PATCH /api/tasks/[id] - TaskController@update
// DELETE    /api/tasks/[id] - TaskController@destroy

export const PUT = route(async (request, { params }) => {
  const user = await requireVerifiedUser();
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = updateTaskSchema.safeParse(body);

  if (!parsed.success) {
    return sendValidationError(parsed.error);
  }

  // Same `exists:course_contents,id` 422 as create (see tasks/route.js).
  const numeric = Number(parsed.data.course_content_id);

  if (!Number.isInteger(numeric) || numeric <= 0) {
    return sendValidationError({
      issues: [
        {
          path: ['course_content_id'],
          message: 'The selected course content id is invalid.',
        },
      ],
    });
  }

  const exists = await prisma.courseContent.findUnique({
    where: { id: BigInt(numeric) },
    select: { id: true },
  });

  if (!exists) {
    return sendValidationError({
      issues: [
        {
          path: ['course_content_id'],
          message: 'The selected course content id is invalid.',
        },
      ],
    });
  }

  const task = await update(user.id, id, parsed.data);

  return sendResponse(task, 'Tugas berhasil diperbarui');
});

export const PATCH = PUT;

export const DELETE = route(async (request, { params }) => {
  const user = await requireVerifiedUser();
  const { id } = await params;

  await remove(user.id, id);

  return sendResponse(null, 'Tugas berhasil dihapus');
});
