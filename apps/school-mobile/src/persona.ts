import type { StoredUser } from '@/auth/session';

type AccessUser =
  | StoredUser
  | null
  | { persona?: string; roles?: string[]; permissions?: string[] };

export function isPrincipalUser(user: AccessUser) {
  if (!user) return false;
  if ('persona' in user && user.persona === 'admin') return true;
  const perms = user.permissions ?? [];
  const roles = (user.roles ?? []).join(' ').toLowerCase();
  return (
    perms.includes('school-mobile:manage') ||
    perms.includes('school-sis:manage') ||
    perms.includes('*') ||
    /\b(principal|school-admin)\b/.test(roles)
  );
}

export function isStaffUser(user: AccessUser) {
  if (!user || isPrincipalUser(user)) return false;
  if ('persona' in user && user.persona === 'teacher') return true;
  const perms = user.permissions ?? [];
  const roles = (user.roles ?? []).join(' ').toLowerCase();
  return perms.includes('school-mobile:staff') || /\bteacher|staff\b/.test(roles);
}

export type AppMode = 'student' | 'office' | 'staff';

export function appMode(user: AccessUser): AppMode {
  if (isPrincipalUser(user)) return 'office';
  if (isStaffUser(user)) return 'staff';
  return 'student';
}
