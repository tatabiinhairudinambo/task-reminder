'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// SPA catch-all: any unknown path redirected to /dashboard. The App Router has
// no <Route path="*">, so this page under app/[...notFound] performs the same
// redirect (server 404s cannot be redirected the same way without middleware).

export default function CatchAll() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard');
  }, [router]);

  return null;
}
