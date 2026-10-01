import { redirect } from 'next/navigation';
import { verifyEmail } from '@/lib/services/auth-service';
import { hasValidSignature } from '@/lib/signed-url';

// GET /api/email/verify/[id]
//
// Replaces Laravel's `signed` middleware + AuthController@verifyEmail.
// On success it redirects the browser to the SPA's confirmation page; on a
// bad/expired signature it returns the framework-shaped 403 body instead.

export async function GET(request, { params }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const pathname = `/api/email/verify/${id}`;

  if (!hasValidSignature(pathname, searchParams)) {
    return Response.json({ message: 'Invalid signature.' }, { status: 403 });
  }

  try {
    await verifyEmail(BigInt(id));
  } catch (error) {
    // Already verified (202) is not an error the user needs to see.
    if (error?.code !== 202) {
      return Response.json({ message: error.message }, { status: 400 });
    }
  }

  return redirect('/auth/email/verified');
}
