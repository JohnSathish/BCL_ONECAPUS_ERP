'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { resolveHomePath, useAuth } from '@/hooks/use-auth';

export default function HomePage() {
  const router = useRouter();
  const { session, isReady } = useAuth();

  useEffect(() => {
    if (!isReady) return;
    if (!session) {
      router.replace('/login');
      return;
    }
    router.replace(resolveHomePath(session.user.roles));
  }, [isReady, session, router]);

  return (
    <div className="flex min-h-screen items-center justify-center text-muted-foreground">
      Redirecting…
    </div>
  );
}
