'use client';

import { Suspense } from 'react';
import ResetPassword from '@/views/Auth/ResetPassword/ResetPassword';

// ResetPassword reads ?token & ?email via useSearchParams, which Next 16
// requires under a <Suspense> boundary on a prerendered page.

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ResetPassword />
    </Suspense>
  );
}
