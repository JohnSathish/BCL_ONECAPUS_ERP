'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import {
  canAccessAdminRoute,
  resolveDefaultAdminHome,
} from '@/lib/permissions/permission-registry';
import { canAccessAdminPortal } from '@/lib/permissions/portal-access';

export function AdminPermissionGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, isReady } = useAuth();

  useEffect(() => {
    if (!isReady || !session) return;

    const roles = session.user.roles ?? [];
    const permissions = session.user.permissions ?? [];

    if (!canAccessAdminPortal(roles, permissions)) return;

    if (pathname === '/admin' && permissions.length > 0) {
      const home = resolveDefaultAdminHome(permissions, roles);
      if (
        home !== '/admin' &&
        roles.some((r) =>
          [
            'front-office-desk',
            'librarian',
            'accountant',
            'transport-coordinator',
            'store-keeper',
          ].includes(r),
        )
      ) {
        router.replace(home);
        return;
      }
    }

    if (!canAccessAdminRoute(pathname, permissions, roles)) {
      const home = resolveDefaultAdminHome(permissions, roles);
      router.replace(
        `/access-denied?from=${encodeURIComponent(pathname)}&redirect=${encodeURIComponent(home)}`,
      );
    }
  }, [isReady, session, pathname, router]);

  return <>{children}</>;
}
