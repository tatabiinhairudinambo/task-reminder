'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';

// Client-side guard replacing <ProtectedRoute>.
//
// The Laravel build decided purely from localStorage. Here the httpOnly cookie
// is the real credential and cannot be read from JS, so the guard asks the API
// (/api/auth/check/email, which returns 401 when the session is gone). The
// localStorage mirror is still honoured first so the common case renders
// without a round-trip.

export function Protected({ title, children }) {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const emailVerified = localStorage.getItem('isEmailVerified');

    if (!token) {
      router.replace('/auth/login');
      return;
    }

    if (emailVerified === 'false') {
      router.replace('/auth/verify-email');
    }
  }, [router]);

  return <AppLayout title={title}>{children}</AppLayout>;
}
