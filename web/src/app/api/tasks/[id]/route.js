import { requireVerifiedUser } from '@/lib/auth';
import { update, remove } from '@/lib/services/task-service';
import { sendResponse, sendValidationError, route } from '@/lib/api-response';
import { updateTaskSchema } from '@/lib/validation';

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
