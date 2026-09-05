'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { canAccessAdminPortal, canAccessApplicantPortal } from '@/lib/permissions/portal-access';
import { isSchoolAdmissionsPublicPath } from '@/lib/school-admissions-portal-routes';
import { useAuth } from '@/hooks/use-auth';

export function SchoolAdmissionsPortalGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, isReady } = useAuth();
  const isPublicRoute = isSchoolAdmissionsPublicPath(pathname);

  useEffect(() => {
    if (!isReady) return;
    if (isPublicRoute) {
      if (!session || pathname === '/school-admissions-portal') return;
      const roles = session.user?.roles ?? [];
      const perms = session.user?.permissions ?? [];
      if (
        canAccessApplicantPortal(roles, perms) &&
        pathname === '/school-admissions-portal/login'
      ) {
        router.replace('/school-admissions-portal/dashboard');
      }
      return;
    }
    if (!session) {
      router.replace('/school-admissions-portal/login');
      return;
    }
    const roles = session.user?.roles ?? [];
    const perms = session.user?.permissions ?? [];
    if (!canAccessApplicantPortal(roles, perms) && !canAccessAdminPortal(roles, perms)) {
      router.replace('/school-admissions-portal/login');
    }
  }, [isPublicRoute, isReady, pathname, router, session]);

  return <>{children}</>;
}
