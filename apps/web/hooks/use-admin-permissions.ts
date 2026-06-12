import { useMemo } from 'react';
import { useAuthStore } from '@/store/auth-store';

const ADMIN_ROLES = ['college-admin', 'super-admin', 'institution-admin'];

export function useAdminPermissions() {
  const session = useAuthStore((s) => s.session);
  return useMemo(() => {
    const user = session?.user;
    const perms = user?.permissions ?? [];
    const roles = user?.roles ?? [];
    const isAdmin = roles.some((r) => ADMIN_ROLES.includes(r));
    const has = (p: string) => perms.includes(p) || isAdmin;
    return {
      canReadUsers: has('users:read'),
      canManageUsers: has('users:manage'),
      canImpersonate: has('users:impersonate'),
      canManageRbac: has('rbac:manage'),
      canReadAudit: has('audit:read'),
      canManageSessions: has('sessions:manage'),
      canManageLookups: has('lookups:manage') || has('lookups:read'),
      canEditLookups: has('lookups:manage'),
      canManageImports: has('imports:manage'),
      isImpersonating: Boolean(user?.isImpersonating),
    };
  }, [session]);
}
