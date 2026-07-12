'use client';

import Link from 'next/link';
import { useEffect, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import {
  canAccessAdminRoute,
  resolveDefaultAdminHome,
} from '@/lib/permissions/permission-registry';
import { canAccessAdminPortal } from '@/lib/permissions/portal-access';

/**
 * Module-level admin gate using ROUTE_PERMISSION_RULES.
 * Complements AdminPortalGuard (portal entry) with per-prefix permissions.
 */
export function AdminPermissionGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() || '/admin';
  const { session, isReady } = useAuth();

  const roles = session?.user.roles ?? [];
  const permissions = session?.user.permissions ?? [];

  const denied = useMemo(() => {
    if (!isReady || !session) return false;
    if (!canAccessAdminPortal(roles, permissions)) return false;
    const isAdminHome = pathname === '/admin' || pathname === '/admin/';
    if (isAdminHome) return false;
    return !canAccessAdminRoute(pathname, permissions, roles);
  }, [isReady, session, pathname, roles, permissions]);

  const home = useMemo(() => resolveDefaultAdminHome(permissions, roles), [permissions, roles]);

  useEffect(() => {
    if (!isReady || !session) return;
    if (!canAccessAdminPortal(roles, permissions)) return;

    if (pathname === '/admin' && permissions.length > 0) {
      const preferred = resolveDefaultAdminHome(permissions, roles);
      if (
        preferred !== '/admin' &&
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
        router.replace(preferred);
      }
    }
  }, [isReady, session, pathname, router, roles, permissions]);

  if (!isReady || !session) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        Verifying permissions…
      </div>
    );
  }

  if (denied) {
    return (
      <div
        className="mx-auto flex max-w-lg flex-col items-center gap-3 px-6 py-16 text-center"
        role="alert"
      >
        <h1 className="text-lg font-semibold text-foreground">Access denied</h1>
        <p className="text-sm text-muted-foreground">
          You do not have permission to open this admin module. Contact your ERP administrator if
          you need access.
        </p>
        <Link
          href={home}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Go to your home
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
