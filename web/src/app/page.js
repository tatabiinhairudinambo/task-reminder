import { redirect } from 'next/navigation';

// "/" redirects to the dashboard, mirroring the SPA's catch-all <Navigate>.

export default function Home() {
  redirect('/dashboard');
}
