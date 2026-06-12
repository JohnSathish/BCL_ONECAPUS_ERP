'use client';

import { useRequireAdminPortal } from '@/hooks/use-require-admin-portal';

import { useAuth } from '@/hooks/use-auth';

import { canAccessAdminPortal } from '@/lib/permissions/portal-access';

export function AdminPortalGuard({ children }: { children: React.ReactNode }) {
  const { isReady, session } = useAuth();

  useRequireAdminPortal();

  if (!isReady || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Verifying access…
      </div>
    );
  }

  const roles = session.user.roles ?? [];

  const permissions = session.user.permissions ?? [];

  if (!canAccessAdminPortal(roles, permissions)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Redirecting…
      </div>
    );
  }

  return <>{children}</>;
}
