'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { canAccessAdminPortal, resolveHomePath } from '@/lib/permissions/portal-access';
import { useAuth } from '@/hooks/use-auth';

export function useRequireAdminPortal() {
  const router = useRouter();
  const pathname = usePathname();
  const { session, isReady } = useAuth();

  useEffect(() => {
    if (!isReady) return;
    if (!session) {
      router.replace('/login');
      return;
    }
    const roles = session.user.roles ?? [];
    const permissions = session.user.permissions ?? [];
    if (!canAccessAdminPortal(roles, permissions)) {
      const home = resolveHomePath(roles, permissions);
      router.replace(
        `/access-denied?from=${encodeURIComponent(pathname)}&redirect=${encodeURIComponent(home)}`,
      );
    }
  }, [isReady, session, router, pathname]);

  return session;
}
