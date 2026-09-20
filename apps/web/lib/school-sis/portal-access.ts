/** St. Luke's web portal routing — school SIS only (not college / TPS). */

export type SchoolSisPortalKind = 'admin' | 'principal' | 'staff' | 'student' | 'none';

export const SCHOOL_SIS_PORTAL = {
  admin: '/admin',
  principal: '/school-sis-portal/principal',
  staff: '/school-sis-portal/staff',
  student: '/school-sis-portal/student',
} as const;

const SCHOOL_ADMIN_ROLES = new Set([
  'college-admin',
  'school-admin',
  'super-admin',
  'erp-administrator',
]);

const PRINCIPAL_ROLES = new Set(['principal', 'vice-principal']);

const STUDENT_ROLES = new Set(['school-student', 'school-parent']);

const STAFF_ROLES = new Set([
  'teacher',
  'office-staff',
  'accountant',
  'librarian',
  'driver',
  'receptionist',
  'hr-manager',
  'fee-collector',
  'exam-coordinator',
  'store-keeper',
  'store-manager',
  'transport-coordinator',
  'front-office-desk',
]);

export function resolveSchoolSisPortalKind(
  roles: string[] = [],
  permissions: string[] = [],
): SchoolSisPortalKind {
  if (permissions.includes('*') || roles.some((role) => SCHOOL_ADMIN_ROLES.has(role))) {
    return 'admin';
  }
  if (
    roles.some((role) => PRINCIPAL_ROLES.has(role)) ||
    permissions.includes('school-mobile:manage')
  ) {
    return 'principal';
  }
  const studentish =
    roles.some((role) => STUDENT_ROLES.has(role)) ||
    permissions.includes('school-mobile:student') ||
    permissions.includes('school-mobile:parent');
  const staffish =
    roles.some((role) => STAFF_ROLES.has(role)) || permissions.includes('school-mobile:staff');
  if (studentish && !staffish) return 'student';
  if (staffish || permissions.includes('school-sis:read')) return 'staff';
  if (studentish) return 'student';
  return 'none';
}

export function resolveSchoolSisHomePath(roles: string[] = [], permissions: string[] = []) {
  const kind = resolveSchoolSisPortalKind(roles, permissions);
  if (kind === 'admin') return SCHOOL_SIS_PORTAL.admin;
  if (kind === 'principal') return SCHOOL_SIS_PORTAL.principal;
  if (kind === 'staff') return SCHOOL_SIS_PORTAL.staff;
  if (kind === 'student') return SCHOOL_SIS_PORTAL.student;
  return '/login';
}

export function canAccessSchoolSisPortalPath(
  roles: string[],
  path: string,
  permissions: string[] = [],
) {
  if (path.startsWith('/school-sis-portal/apply')) return true;
  const kind = resolveSchoolSisPortalKind(roles, permissions);
  if (kind === 'none') return false;
  if (path === '/school-sis-portal' || path === '/school-sis-portal/me') return true;
  if (path.startsWith('/school-sis-portal/student')) return kind === 'student';
  if (path.startsWith('/school-sis-portal/staff')) return kind === 'staff';
  if (path.startsWith('/school-sis-portal/principal')) return kind === 'principal';
  return false;
}

export function schoolSisPortalKindFromPersona(persona?: string | null): SchoolSisPortalKind {
  if (persona === 'admin') return 'principal';
  if (persona === 'student' || persona === 'parent') return 'student';
  if (
    persona === 'teacher' ||
    persona === 'accountant' ||
    persona === 'librarian' ||
    persona === 'transport'
  ) {
    return 'staff';
  }
  return 'none';
}
