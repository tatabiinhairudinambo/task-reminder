import { requireVerifiedUser } from '@/lib/auth';
import { getAuthenticatedUser } from '@/lib/services/user-service';
import { sendResponse, route } from '@/lib/api-response';

// GET /api/auth/user - UserController@getAuthenticatedUser

export const GET = route(async () => {
  const user = await requireVerifiedUser();
  const data = await getAuthenticatedUser(user);

  return sendResponse(data, 'Data pengguna berhasil diambil');
});
