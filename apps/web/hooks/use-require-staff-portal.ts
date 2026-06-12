'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { canAccessStaffPortal, resolveHomePath, useAuth } from '@/hooks/use-auth';

export function useRequireStaffPortal() {
  const router = useRouter();
  const { session, isReady } = useAuth();

  useEffect(() => {
    if (!isReady) return;
    if (!session) {
      router.replace('/login');
      return;
    }
    if (!canAccessStaffPortal(session.user.roles)) {
      router.replace(resolveHomePath(session.user.roles));
    }
  }, [isReady, session, router]);

  return session;
}
