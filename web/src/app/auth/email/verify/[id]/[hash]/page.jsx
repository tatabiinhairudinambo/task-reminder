'use client';

import { Suspense } from 'react';
import VerifiedEmail from '@/views/Auth/Register/VerifiedEmail';

// VerifiedEmail reads the signed-URL query params, which Next requires under a
// Suspense boundary on a prerendered page.

export default function VerifiedEmailRoute() {
  return (
    <Suspense fallback={null}>
      <VerifiedEmail />
    </Suspense>
  );
}
