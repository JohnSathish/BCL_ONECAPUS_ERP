'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import {
  hasAllListedPermissions,
  hasAnyListedPermission,
  isSuperAdmin,
} from '@/lib/permissions/permission-registry';

export function usePermissions() {
  const { session } = useAuth();
  const permissions = session?.user?.permissions ?? [];
  const roles = session?.user?.roles ?? [];
  const admin = isSuperAdmin(roles);

  return {
    permissions,
    roles,
    isAdmin: admin,
    can: (permission: string) => admin || permissions.includes(permission),
    canAny: (...slugs: string[]) => hasAnyListedPermission(permissions, roles, slugs),
    canAll: (...slugs: string[]) => hasAllListedPermissions(permissions, roles, slugs),
  };
}

export function useRequirePermission(...required: string[]) {
  const router = useRouter();
  const { session, isReady } = useAuth();
  const { canAny } = usePermissions();

  useEffect(() => {
    if (!isReady || !session) return;
    if (required.length && !canAny(...required)) {
      router.replace('/access-denied');
    }
  }, [isReady, session, canAny, required, router]);

  return session;
}
