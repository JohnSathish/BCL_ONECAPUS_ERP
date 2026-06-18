'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import {
  canAccessStaffPortal,
  resolveHomePath as portalHomePath,
} from '@/lib/permissions/portal-access';

const ROLE_HOME: Record<string, string> = {
  'platform-admin': '/platform',
  'college-admin': '/admin',
  'super-admin': '/admin',
  'university-admin': '/admin',
  'shift-admin': '/shift',
  'shift-academic-coordinator': '/shift',
  'shift-attendance-manager': '/shift',
  'shift-examination-coordinator': '/shift',
  faculty: '/staff/dashboard',
  staff: '/staff/dashboard',
  student: '/student',
  parent: '/parent',
  'library-operator': '/library-desk',
  applicant: '/admissions-portal/dashboard',
};

export { canAccessStaffPortal } from '@/lib/permissions/portal-access';
export {
  canAccessAdminPortal,
  canAccessPlatformPortal,
  canAccessStudentPortal,
  sanitizeNotificationLink,
} from '@/lib/permissions/portal-access';

export function useAuth() {
  const session = useAuthStore((s) => s.session);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const isBootstrapping = useAuthStore((s) => s.isBootstrapping);
  return { session, hasHydrated, isBootstrapping, isReady: hasHydrated && !isBootstrapping };
}

/** Use as React Query `enabled` so protected API calls wait for session restore. */
export function useAuthQueryEnabled() {
  const { isReady, session } = useAuth();
  if (!isReady || !session?.accessToken) return false;
  if (session.expiresAt) {
    return new Date(session.expiresAt).getTime() > Date.now();
  }
  return true;
}

export function useRequireAuth() {
  const router = useRouter();
  const { session, isReady } = useAuth();

  useEffect(() => {
    if (isReady && !session) {
      router.replace('/login');
    }
  }, [isReady, session, router]);

  return session;
}

export function resolveHomePath(roles: string[]) {
  const session = useAuthStore.getState().session;
  const permissions = session?.user?.permissions ?? [];
  for (const role of roles) {
    if (ROLE_HOME[role]) return ROLE_HOME[role];
  }
  return portalHomePath(roles, permissions);
}
