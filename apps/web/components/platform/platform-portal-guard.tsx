'use client';

import { useAuth } from '@/hooks/use-auth';
import { useRequirePlatformPortal } from '@/hooks/use-require-platform-portal';
import { canAccessPlatformPortal } from '@/lib/permissions/portal-access';

export function PlatformPortalGuard({ children }: { children: React.ReactNode }) {
  const { isReady, session } = useAuth();
  useRequirePlatformPortal();

  if (!isReady || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Verifying access…
      </div>
    );
  }

  if (!canAccessPlatformPortal(session.user.roles ?? [], session.user.permissions ?? [])) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Redirecting…
      </div>
    );
  }

  return <>{children}</>;
}
