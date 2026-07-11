import type { Href } from 'expo-router';

export type MobilePersona =
  | 'student'
  | 'faculty'
  | 'principal'
  | 'shift-admin'
  | 'admin'
  | 'library'
  | 'finance';

export type MobileRouteDecision = {
  persona: MobilePersona;
  href: Href;
  appType: 'student' | 'staff';
  title: string;
  subtitle: string;
};

type SessionUser = {
  permissions?: string[];
  roles?: string[];
  shiftIds?: string[];
  allShifts?: boolean;
};

const PRINCIPAL_ROLES = new Set(['principal', 'vice-principal', 'erp-administrator']);
const SHIFT_ADMIN_ROLES = new Set(['shift-admin', 'shift-academic-coordinator']);
const FACULTY_ROLES = new Set(['faculty', 'staff']);
const LIBRARY_ROLES = new Set(['librarian', 'library-operator']);
const FINANCE_ROLES = new Set(['accountant']);

export function resolveMobileRoute(user: SessionUser): MobileRouteDecision {
  const perms = user.permissions ?? [];
  const roles = user.roles ?? [];

  const isStudent = perms.includes('student:portal:self');
  const isStaff = perms.includes('staff:portal:self');
  const isPrincipal =
    perms.includes('principal-desk:access') || roles.some((r) => PRINCIPAL_ROLES.has(r));
  const isShiftAdmin = roles.some((r) => SHIFT_ADMIN_ROLES.has(r));
  const isFaculty = roles.some((r) => FACULTY_ROLES.has(r));
  const isLibrary = roles.some((r) => LIBRARY_ROLES.has(r));
  const isFinance = roles.some((r) => FINANCE_ROLES.has(r));
  const isSuperAdmin = roles.includes('super-admin') || perms.includes('platform:admin');

  if (isStudent && !isStaff && !isPrincipal && !isShiftAdmin && !isSuperAdmin) {
    return {
      persona: 'student',
      href: '/(student)/(tabs)/index' as Href,
      appType: 'student',
      title: 'Student Dashboard',
      subtitle: 'Attendance, academics, fees & more',
    };
  }

  if (isPrincipal) {
    return {
      persona: 'principal',
      href: '/(staff)/(tabs)' as Href,
      appType: 'staff',
      title: 'Principal Dashboard',
      subtitle: 'Institution overview & approvals',
    };
  }

  if (isShiftAdmin) {
    const shiftLabel = user.allShifts ? 'Campus' : 'Shift';
    return {
      persona: 'shift-admin',
      href: '/(staff)/(tabs)' as Href,
      appType: 'staff',
      title: `${shiftLabel} Workspace`,
      subtitle: 'Shift students, staff, attendance & reports',
    };
  }

  if (isLibrary) {
    return {
      persona: 'library',
      href: '/(staff)/(tabs)' as Href,
      appType: 'staff',
      title: 'Library Desk',
      subtitle: 'Circulation & member services',
    };
  }

  if (isFinance) {
    return {
      persona: 'finance',
      href: '/(staff)/(tabs)' as Href,
      appType: 'staff',
      title: 'Finance Desk',
      subtitle: 'Fees, receipts & collections',
    };
  }

  if (isSuperAdmin || perms.some((p) => p.startsWith('mobile:settings'))) {
    return {
      persona: 'admin',
      href: '/(staff)/(tabs)' as Href,
      appType: 'staff',
      title: 'Institution Dashboard',
      subtitle: 'Full campus administration',
    };
  }

  if (isStaff || isFaculty) {
    return {
      persona: 'faculty',
      href: '/(staff)/(tabs)' as Href,
      appType: 'staff',
      title: 'Faculty Dashboard',
      subtitle: "Today's classes, attendance & marks",
    };
  }

  if (isStudent) {
    return {
      persona: 'student',
      href: '/(student)/(tabs)' as Href,
      appType: 'student',
      title: 'Student Dashboard',
      subtitle: 'Attendance, academics, fees & more',
    };
  }

  return {
    persona: 'admin',
    href: '/(auth)/login' as Href,
    appType: 'staff',
    title: 'OneCampus',
    subtitle: 'No mobile portal access for this account',
  };
}

export function canAccessMobile(user: SessionUser): boolean {
  const perms = user.permissions ?? [];
  return perms.includes('student:portal:self') || perms.includes('staff:portal:self');
}
