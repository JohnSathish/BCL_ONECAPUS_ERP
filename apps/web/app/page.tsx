'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LandingPage } from '@/components/landing/landing-page';
import { resolveHomePath, useAuth } from '@/hooks/use-auth';

export default function HomePage() {
  const router = useRouter();
  const { session, isReady } = useAuth();

  useEffect(() => {
    if (!isReady) return;
    if (session) {
      router.replace(resolveHomePath(session.user.roles));
    }
  }, [isReady, session, router]);

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white/50">
        Loading…
      </div>
    );
  }

  if (session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white/50">
        Redirecting…
      </div>
    );
  }

  return <LandingPage />;
}
