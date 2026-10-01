'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';

// Client-side guard mirroring client/src/components/ProtectedRoute: the
// localStorage token mirror decides access, and redirects happen before the
// protected shell paints (the old version always rendered the shell and
// redirected afterwards, so unauthenticated visitors saw the app flash).
//
// The first render (SSR + hydration) must not decide - localStorage does not
// exist on the server - so it renders nothing; the effect then redirects or
// unlocks the shell. This avoids both a hydration mismatch and the flash.

export function Protected({ title, children }) {
  const router = useRouter();
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const emailVerified = localStorage.getItem('isEmailVerified');

    if (!token) {
      router.replace('/auth/login');
      return;
    }

    if (emailVerified === 'false') {
      router.replace('/auth/verify-email');
      return;
    }

    setUnlocked(true);
  }, [router]);

  if (!unlocked) {
    return null;
  }

  return <AppLayout title={title}>{children}</AppLayout>;
}
