'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// Confirmation page for a verified email.
//
// In the Laravel build this page performed the verification itself (reading
// ?expires&signature and calling the API). Verification now happens server-side
// in /api/email/verify/[id], which validates the signature and then redirects
// here, so this page only has to show the outcome and forward the user on.

export default function VerifiedEmailPage() {
  const router = useRouter();

  useEffect(() => {
    localStorage.setItem('isEmailVerified', true);
    localStorage.removeItem('isPasswordReset');

    const timer = setTimeout(() => router.replace('/dashboard'), 3000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <img src="/logo.webp" className="mb-8 mt-4 w-32" alt="logo" />
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Email Terverifikasi</CardTitle>
          <CardDescription>
            Alamat email Anda berhasil diverifikasi. Anda akan segera dialihkan.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
