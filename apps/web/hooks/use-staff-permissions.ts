import { useMemo } from 'react';
import { useAuthStore } from '@/store/auth-store';

const ADMIN_ROLES = ['college-admin', 'super-admin', 'university-admin'];

export function useStaffPermissions() {
  const session = useAuthStore((s) => s.session);
  return useMemo(() => {
    const perms = session?.user.permissions ?? [];
    const roles = session?.user.roles ?? [];
    const isAdmin = roles.some((r) => ADMIN_ROLES.includes(r));
    const has = (p: string) => perms.includes(p) || isAdmin;
    return {
      canRead: has('staff:read'),
      canManage: has('staff:manage'),
      canAssignSubjects: has('staff:assign-subjects'),
      canPortal: has('staff:portal'),
      canExport: has('staff:export'),
      canImport: has('staff:import'),
      canBulkUpdate: has('staff:bulk-update') || has('staff:manage'),
      canBulkUpdateRollback: has('staff:bulk-update:rollback'),
    };
  }, [session]);
}
