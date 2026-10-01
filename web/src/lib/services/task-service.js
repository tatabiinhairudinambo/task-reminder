import { prisma } from '@/lib/db';
import { ApiError } from '@/lib/api-response';
import { serializeTask, num } from '@/lib/serialize';
import { toBoolean } from '@/lib/validation';

// Port of App\Services\TaskService.
//
// Ownership contract (same as Laravel): every query is scoped by user_id and
// a foreign id returns 404, never 403, so a cross-owner id does not reveal
// whether the row exists. `update` also re-scopes the incoming
// course_content_id, mirroring create.

async function ownedCourseContent(userId, courseContentId) {
  const course = await prisma.courseContent.findFirst({
    where: { id: BigInt(courseContentId), user_id: userId },
  });

  if (!course) {
    throw new ApiError('Mata kuliah tidak ditemukan', 404);
  }

  return course;
}

export async function create(user, data) {
  const courseContent = await ownedCourseContent(user.id, data.course_content_id);
  const now = new Date();

  const task = await prisma.task.create({
    data: {
      task: data.task,
      description: data.description ?? null,
      deadline: new Date(data.deadline),
      priority: toBoolean(data.priority),
      status: false,
      user_id: user.id,
      course_content_id: courseContent.id,
      created_at: now,
      updated_at: now,
    },
  });

  return serializeTask(task);
}

export async function update(userId, id, data) {
  const existing = await prisma.task.findFirst({
    where: { id: BigInt(id), user_id: userId },
  });

  if (!existing) {
    throw new ApiError('Tugas tidak ditemukan', 404);
  }

  const courseContent = await ownedCourseContent(userId, data.course_content_id);

  const task = await prisma.task.update({
    where: { id: existing.id },
    data: {
      task: data.task,
      description: data.description ?? null,
      deadline: new Date(data.deadline),
      priority: toBoolean(data.priority),
      course_content_id: courseContent.id,
      updated_at: new Date(),
    },
  });

  return serializeTask(task);
}

export async function remove(userId, id) {
  const existing = await prisma.task.findFirst({
    where: { id: BigInt(id), user_id: userId },
  });

  if (!existing) {
    throw new ApiError('Tugas tidak ditemukan', 404);
  }

  await prisma.task.delete({ where: { id: existing.id } });

  return true;
}

/**
 * Flip status 0 <-> 1. Returns the task WITH the course_content relation
 * because the SPA reads `task.course_content.*` after toggling.
 * Also reports whether the task became completed, so the route can notify.
 */
export async function toggleStatus(user, id) {
  const existing = await prisma.task.findFirst({
    where: { id: BigInt(id), user_id: user.id },
    include: { courseContent: true },
  });

  if (!existing) {
    throw new ApiError('Tugas tidak ditemukan', 404);
  }

  const nowCompleted = !existing.status;

  const task = await prisma.task.update({
    where: { id: existing.id },
    data: { status: nowCompleted, updated_at: new Date() },
    include: { courseContent: true },
  });

  return {
    task: serializeTask(task, { withCourseContent: true }),
    becameCompleted: nowCompleted,
  };
}

export { num };
