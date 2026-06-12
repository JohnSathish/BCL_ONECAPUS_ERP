'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { resolveHomePath } from '@/lib/permissions/portal-access';

export default function AccountantRedirectPage() {
  const router = useRouter();
  const { session, isReady } = useAuth();

  useEffect(() => {
    if (!isReady) return;
    if (!session) {
      router.replace('/login');
      return;
    }
    router.replace(resolveHomePath(session.user.roles ?? [], session.user.permissions ?? []));
  }, [isReady, session, router]);

  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
      Redirecting to finance workspace…
    </div>
  );
}
