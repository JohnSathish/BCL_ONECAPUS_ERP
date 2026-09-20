'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import {
  resolveSchoolSisHomePath,
  resolveSchoolSisPortalKind,
  type SchoolSisPortalKind,
} from '@/lib/school-sis/portal-access';

export function PortalGuard({
  kind,
  children,
}: {
  kind: Exclude<SchoolSisPortalKind, 'admin' | 'none'>;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { session, isReady } = useAuth();

  useEffect(() => {
    if (!isReady) return;
    if (!session?.accessToken) {
      router.replace('/login');
      return;
    }
    if (session.user.mustResetPassword) {
      router.replace('/change-password');
      return;
    }
    const roles = session.user.roles ?? [];
    const permissions = session.user.permissions ?? [];
    const actual = resolveSchoolSisPortalKind(roles, permissions);
    if (actual !== kind) {
      router.replace(resolveSchoolSisHomePath(roles, permissions));
    }
  }, [isReady, session, router, kind]);

  if (!isReady || !session?.accessToken) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-slate-600">
        Signing you in…
      </div>
    );
  }
  return <>{children}</>;
}
