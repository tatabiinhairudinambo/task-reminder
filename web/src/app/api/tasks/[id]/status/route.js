import { requireVerifiedUser } from '@/lib/auth';
import { toggleStatus } from '@/lib/services/task-service';
import { notifyTaskCompleted } from '@/lib/services/notification-service';
import { sendResponse, route } from '@/lib/api-response';

// PATCH /api/tasks/[id]/status - TaskController@statusChanged
//
// Flips 0 <-> 1 and returns the task with its course_content relation, since
// the SPA reads `task.course_content.*` after toggling.

export const PATCH = route(async (request, { params }) => {
  const user = await requireVerifiedUser();
  const { id } = await params;

  const { task, becameCompleted } = await toggleStatus(user, id);

  if (becameCompleted) {
    try {
      await notifyTaskCompleted(user.id, {
        courseContent: task.course_content?.course_content ?? '-',
        task: task.task,
        description: task.description,
      });
    } catch (error) {
      console.warn('[tasks] task-completed notification failed', error.message);
    }
  }

  return sendResponse(task, 'Status tugas berhasil diubah');
});
