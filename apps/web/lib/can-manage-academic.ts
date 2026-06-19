import { isSuperAdmin } from '@/lib/permissions/permission-registry';

type SessionLike = {
  user?: { roles?: string[]; permissions?: string[] };
} | null;

export function canManageAcademic(session: SessionLike): boolean {
  const roles = session?.user?.roles ?? [];
  const perms = session?.user?.permissions ?? [];
  return isSuperAdmin(roles) || perms.includes('academic:manage');
}

export function canManageOrganization(session: SessionLike): boolean {
  const roles = session?.user?.roles ?? [];
  const perms = session?.user?.permissions ?? [];
  return isSuperAdmin(roles) || perms.includes('org:manage');
}
