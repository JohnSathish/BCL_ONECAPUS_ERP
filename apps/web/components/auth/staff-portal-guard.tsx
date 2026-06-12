'use client';

import { useRequireStaffPortal } from '@/hooks/use-require-staff-portal';
import { useAuth } from '@/hooks/use-auth';
import { canAccessStaffPortal } from '@/hooks/use-auth';

export function StaffPortalGuard({ children }: { children: React.ReactNode }) {
  const { isReady, session } = useAuth();
  useRequireStaffPortal();

  if (!isReady || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Verifying access…
      </div>
    );
  }

  if (!canAccessStaffPortal(session.user.roles ?? [])) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Redirecting…
      </div>
    );
  }

  return <>{children}</>;
}
