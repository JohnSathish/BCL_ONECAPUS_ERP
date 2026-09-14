'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoginForm } from '@/components/auth/login-form';
import { useAuth } from '@/hooks/use-auth';
import { logoutClientSide } from '@/lib/auth/client-logout';
import { canAccessAdminPortal, canAccessLibraryDesk } from '@/lib/permissions/portal-access';

function canOpenLibraryDesk(roles: string[], permissions: string[]) {
  return canAccessLibraryDesk(roles, permissions) || canAccessAdminPortal(roles, permissions);
}

export default function LibraryDeskLoginPage() {
  const router = useRouter();
  const { session, isReady } = useAuth();

  useEffect(() => {
    if (!isReady || !session) return;
    const roles = session.user.roles ?? [];
    const permissions = session.user.permissions ?? [];
    if (canOpenLibraryDesk(roles, permissions)) {
      window.location.replace('/library-desk');
      return;
    }
    logoutClientSide(router, { redirectTo: '/library-desk/login' });
  }, [isReady, session, router]);

  if (
    isReady &&
    session &&
    canOpenLibraryDesk(session.user.roles ?? [], session.user.permissions ?? [])
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-sm text-slate-400">
        Opening library desk…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <LoginForm compact hardRedirect postLoginPath="/library-desk" />
    </div>
  );
}
