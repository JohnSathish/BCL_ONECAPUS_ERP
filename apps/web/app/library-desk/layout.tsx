'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { canAccessLibraryDesk, canAccessAdminPortal } from '@/lib/permissions/portal-access';
import { useAuth } from '@/hooks/use-auth';

function LibraryDeskLoading({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 text-sm text-slate-400">
      {message}
    </div>
  );
}

export default function LibraryDeskLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, isReady } = useAuth();
  const isLogin = pathname?.startsWith('/library-desk/login');

  useEffect(() => {
    if (!isReady || isLogin) return;
    if (!session) {
      router.replace('/library-desk/login');
      return;
    }
    const roles = session.user?.roles ?? [];
    const perms = session.user?.permissions ?? [];
    if (!canAccessLibraryDesk(roles, perms) && !canAccessAdminPortal(roles, perms)) {
      router.replace('/login');
    }
  }, [isReady, session, router, isLogin]);

  if (isLogin) {
    if (!isReady) {
      return <LibraryDeskLoading message="Loading…" />;
    }
    return <div className="min-h-screen">{children}</div>;
  }

  if (!isReady) {
    return <LibraryDeskLoading message="Loading…" />;
  }

  if (!session) {
    return <LibraryDeskLoading message="Redirecting to sign in…" />;
  }

  const roles = session.user?.roles ?? [];
  const perms = session.user?.permissions ?? [];
  if (!canAccessLibraryDesk(roles, perms) && !canAccessAdminPortal(roles, perms)) {
    return <LibraryDeskLoading message="Redirecting…" />;
  }

  return <div className="min-h-screen">{children}</div>;
}
