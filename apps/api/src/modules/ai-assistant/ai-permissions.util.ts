import type { JwtUser } from '../../common/decorators/current-user.decorator';

export function userHasAnyPermission(
  user: JwtUser,
  permissions: string[],
): boolean {
  const set = new Set(user.permissions ?? []);
  if (set.has('*') || set.has('admin:*')) return true;
  return permissions.some((p) => set.has(p));
}

export const AI_PERMS = {
  students: [
    'students:read',
    'students:manage',
    'students:profile-verify',
    'reports:read',
  ],
  staff: ['staff:read', 'staff:manage', 'hr:read', 'hr:manage'],
  fees: ['fees:read', 'fees:manage', 'reports:read'],
  attendance: [
    'student-attendance:view',
    'student-attendance:reports',
    'academic:read',
    'academic:manage',
    'reports:read',
  ],
  reports: ['reports:read', 'students:read', 'students:manage'],
  admissions: [
    'admissions:read',
    'admissions:manage',
    'front-office:read',
    'reports:read',
  ],
  academic: [
    'academic:read',
    'academic:manage',
    'programs:read',
    'reports:read',
  ],
  communication: [
    'communication:read',
    'communication:manage',
    'communication:send',
  ],
  certificates: ['certificates:read', 'certificates:manage'],
  promotion: [
    'academic:manage',
    'academic-lifecycle:manage',
    'students:manage',
  ],
  dashboard: [
    'reports:read',
    'academic:read',
    'academic:manage',
    'students:read',
    'fees:read',
    'front-office:read',
    'library:read',
  ],
} as const;
