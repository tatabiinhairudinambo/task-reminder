import { requireVerifiedUser } from '@/lib/auth';
import { create } from '@/lib/services/task-service';
import { notifyTaskCreated } from '@/lib/services/notification-service';
import { sendResponse, sendValidationError, route } from '@/lib/api-response';
import { storeTaskSchema } from '@/lib/validation';
import { prisma } from '@/lib/db';

// POST /api/tasks - TaskController@store
//
// Laravel queued TaskCreatedNotification when the setting is on. There is no
// queue worker on Vercel, so it is sent inline after the row is committed.

export const POST = route(async (request) => {
  const user = await requireVerifiedUser();
  const body = await request.json().catch(() => ({}));
  const parsed = storeTaskSchema.safeParse(body);

  if (!parsed.success) {
    return sendValidationError(parsed.error);
  }

  // `exists:course_contents,id` runs as Form Request validation in Laravel, so
  // a missing id is a 422 - not the 404 the ownership check in the service
  // produces for a foreign row.
  if (!(await courseContentExists(parsed.data.course_content_id))) {
    return sendValidationError({
      issues: [
        {
          path: ['course_content_id'],
          message: 'The selected course content id is invalid.',
        },
      ],
    });
  }

  const task = await create(user, parsed.data);

  // Best-effort: a delivery failure must not fail the create.
  try {
    await notifyTaskCreated(user.id, {
      courseContent: await courseName(task.course_content_id),
      task: task.task,
      deadline: task.deadline,
      description: task.description,
    });
  } catch (error) {
    console.warn('[tasks] task-created notification failed', error.message);
  }

  return sendResponse(task, 'Tugas berhasil dibuat', 201);
});

async function courseContentExists(courseContentId) {
  const numeric = Number(courseContentId);

  if (!Number.isInteger(numeric) || numeric <= 0) {
    return false;
  }

  const row = await prisma.courseContent.findUnique({
    where: { id: BigInt(numeric) },
    select: { id: true },
  });

  return Boolean(row);
}

async function courseName(courseContentId) {
  const course = await prisma.courseContent.findUnique({
    where: { id: BigInt(courseContentId) },
    select: { course_content: true },
  });

  return course?.course_content ?? '-';
}
