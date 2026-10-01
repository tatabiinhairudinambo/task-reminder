import { requireVerifiedUser } from '@/lib/auth';
import { create } from '@/lib/services/task-service';
import { notifyTaskCreated } from '@/lib/services/notification-service';
import { sendResponse, sendValidationError, route } from '@/lib/api-response';
import { storeTaskSchema } from '@/lib/validation';

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

async function courseName(courseContentId) {
  const { prisma } = await import('@/lib/db');
  const course = await prisma.courseContent.findUnique({
    where: { id: BigInt(courseContentId) },
    select: { course_content: true },
  });

  return course?.course_content ?? '-';
}
