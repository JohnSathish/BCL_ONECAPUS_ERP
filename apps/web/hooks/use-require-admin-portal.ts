'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { canAccessAdminPortal, resolveHomePath } from '@/lib/permissions/portal-access';
import { useAuth } from '@/hooks/use-auth';
import { isSecondarySchoolSisSession } from '@/lib/school-erp/product';
import {
  resolveSchoolSisHomePath,
  resolveSchoolSisPortalKind,
} from '@/lib/school-sis/portal-access';

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
    const sis = isSecondarySchoolSisSession({
      tenantSlug: session.user.tenantSlug,
      hostname: typeof window !== 'undefined' ? window.location.hostname : undefined,
    });
    if (sis) {
      const kind = resolveSchoolSisPortalKind(roles, permissions);
      if (kind !== 'admin') {
        router.replace(resolveSchoolSisHomePath(roles, permissions));
        return;
      }
    }
    if (!canAccessAdminPortal(roles, permissions)) {
      const home = sis
        ? resolveSchoolSisHomePath(roles, permissions)
        : resolveHomePath(roles, permissions);
      router.replace(
        `/access-denied?from=${encodeURIComponent(pathname)}&redirect=${encodeURIComponent(home)}`,
      );
    }
  }, [isReady, session, router, pathname]);

  return session;
}
