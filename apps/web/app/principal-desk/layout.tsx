'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { canAccessAdminPortal, canAccessPrincipalDesk } from '@/lib/permissions/portal-access';
import { useAuth } from '@/hooks/use-auth';

export default function PrincipalDeskLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, isReady } = useAuth();
  const isLogin = pathname?.startsWith('/principal-desk/login');

  useEffect(() => {
    if (!isReady || isLogin) return;
    if (!session) {
      router.replace('/principal-desk/login');
      return;
    }
    const roles = session.user?.roles ?? [];
    const perms = session.user?.permissions ?? [];
    if (!canAccessPrincipalDesk(roles, perms) && !canAccessAdminPortal(roles, perms)) {
      router.replace('/login');
    }
  }, [isReady, session, router, isLogin]);

  return <div className="min-h-screen">{children}</div>;
}
