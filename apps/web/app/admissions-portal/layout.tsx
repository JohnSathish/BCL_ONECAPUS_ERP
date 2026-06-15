'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { canAccessApplicantPortal } from '@/lib/permissions/portal-access';
import { useAuth } from '@/hooks/use-auth';

const PUBLIC_ROUTES = [
  '/admissions-portal',
  '/admissions-portal/login',
  '/admissions-portal/register',
];

export default function AdmissionsPortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, isReady } = useAuth();
  const isPublicRoute = PUBLIC_ROUTES.some((p) => pathname === p);

  useEffect(() => {
    if (!isReady || isPublicRoute) return;
    if (!session) {
      router.replace('/admissions-portal/login');
      return;
    }
    const roles = session.user?.roles ?? [];
    const perms = session.user?.permissions ?? [];
    if (!canAccessApplicantPortal(roles, perms)) {
      router.replace('/login');
    }
  }, [isReady, session, router, isPublicRoute]);

  return <>{children}</>;
}
