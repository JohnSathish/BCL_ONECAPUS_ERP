'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { canAccessAdminPortal, canAccessApplicantPortal } from '@/lib/permissions/portal-access';
import { isAdmissionsPublicPath } from '@/lib/admissions-portal-routes';
import { useAuth } from '@/hooks/use-auth';

function AdmissionsPortalLoading({ message }: { message: string }) {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#0b1628] via-[#152a45] to-[#0f1d33] text-sm text-slate-400"
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
}

export default function AdmissionsPortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, isReady } = useAuth();
  const isPublicRoute = isAdmissionsPublicPath(pathname);

  useEffect(() => {
    if (!isReady) return;

    if (isPublicRoute) {
      if (!session || pathname !== '/admissions-portal') return;
      const roles = session.user?.roles ?? [];
      const perms = session.user?.permissions ?? [];
      if (canAccessApplicantPortal(roles, perms)) {
        router.replace('/admissions-portal/dashboard');
      }
      return;
    }

    if (!session) {
      router.replace('/admissions-portal/login');
      return;
    }

    const roles = session.user?.roles ?? [];
    const perms = session.user?.permissions ?? [];
    if (!canAccessApplicantPortal(roles, perms) && !canAccessAdminPortal(roles, perms)) {
      router.replace('/admissions-portal/login');
    }
  }, [isReady, session, router, isPublicRoute, pathname]);

  if (isPublicRoute) {
    if (!isReady) {
      return <AdmissionsPortalLoading message="Loading…" />;
    }
    return <>{children}</>;
  }

  if (!isReady) {
    return <AdmissionsPortalLoading message="Loading…" />;
  }

  if (!session) {
    return <AdmissionsPortalLoading message="Redirecting to sign in…" />;
  }

  const roles = session.user?.roles ?? [];
  const perms = session.user?.permissions ?? [];
  if (!canAccessApplicantPortal(roles, perms) && !canAccessAdminPortal(roles, perms)) {
    return <AdmissionsPortalLoading message="Redirecting…" />;
  }

  return <>{children}</>;
}
