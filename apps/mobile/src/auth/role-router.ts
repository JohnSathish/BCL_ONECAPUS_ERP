import type { Href } from 'expo-router';

export type MobilePersona =
  | 'student'
  | 'faculty'
  | 'principal'
  | 'shift-admin'
  | 'admin'
  | 'library'
  | 'finance'
  | 'school-student'
  | 'school-parent'
  | 'school-teacher'
  | 'school-admin'
  | 'school-accountant'
  | 'school-librarian'
  | 'school-transport';

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

const SHIFT_ADMIN_ROLES = new Set(['shift-admin', 'shift-academic-coordinator']);
const FACULTY_ROLES = new Set(['faculty', 'staff']);
const LIBRARY_ROLES = new Set(['librarian', 'library-operator']);
const FINANCE_ROLES = new Set(['accountant']);

export function hasSchoolMobileAccess(user: SessionUser) {
  const perms = user.permissions ?? [];
  return (
    perms.includes('school-mobile:student') ||
    perms.includes('school-mobile:parent') ||
    perms.includes('school-mobile:staff') ||
    perms.includes('school-mobile:manage') ||
    perms.includes('school-sis:read') ||
    perms.includes('school-sis:manage')
  );
}

export function resolveSchoolMobileRoute(user: SessionUser): MobileRouteDecision | null {
  if (!hasSchoolMobileAccess(user)) return null;
  const perms = user.permissions ?? [];
  const roles = (user.roles ?? []).join(' ').toLowerCase();
  const href = '/(school)/(tabs)' as Href;
  if (perms.includes('school-mobile:parent') || /\bparent\b/.test(roles)) {
    return {
      persona: 'school-parent',
      href,
      appType: 'student',
      title: 'Parent Dashboard',
      subtitle: 'Children, attendance, fees & notices',
    };
  }
  if (perms.includes('school-mobile:student') && !perms.includes('school-sis:read')) {
    return {
      persona: 'school-student',
      href,
      appType: 'student',
      title: 'Student Dashboard',
      subtitle: 'Attendance, timetable, fees & exams',
    };
  }
  if (perms.includes('fees.collection.view') || /\baccountant|accounts\b/.test(roles)) {
    return {
      persona: 'school-accountant',
      href,
      appType: 'staff',
      title: 'Accounts Desk',
      subtitle: 'Fees, collections and receipts',
    };
  }
  if (perms.includes('library.issue') || /\blibrarian\b/.test(roles)) {
    return {
      persona: 'school-librarian',
      href,
      appType: 'staff',
      title: 'Library Desk',
      subtitle: 'Catalogue and issued books',
    };
  }
  if (perms.includes('transport.routes.view') || /\btransport\b/.test(roles)) {
    return {
      persona: 'school-transport',
      href,
      appType: 'staff',
      title: 'Transport Desk',
      subtitle: 'Routes, vehicles and trips',
    };
  }
  if (
    perms.includes('school-mobile:manage') ||
    perms.includes('school-sis:manage') ||
    perms.includes('*') ||
    /\bprincipal|school-admin|college-admin\b/.test(roles)
  ) {
    return {
      persona: 'school-admin',
      href,
      appType: 'staff',
      title: 'School Administration',
      subtitle: 'Students, attendance, fees and reports',
    };
  }
  return {
    persona: 'school-teacher',
    href,
    appType: 'staff',
    title: 'Staff Dashboard',
    subtitle: "Today's classes, attendance and leave",
  };
}

export function resolveMobileRoute(user: SessionUser): MobileRouteDecision {
  const school = resolveSchoolMobileRoute(user);
  if (school) return school;

  const perms = user.permissions ?? [];
  const roles = user.roles ?? [];

  const isStudent = perms.includes('student:portal:self');
  const isStaff = perms.includes('staff:portal:self');
  const isPrincipalMobile = perms.includes('principal-mobile:access');
  const isShiftAdmin = roles.some((r) => SHIFT_ADMIN_ROLES.has(r));
  const isFaculty = roles.some((r) => FACULTY_ROLES.has(r));
  const isLibrary = roles.some((r) => LIBRARY_ROLES.has(r));
  const isFinance = roles.some((r) => FINANCE_ROLES.has(r));
  const isSuperAdmin = roles.includes('super-admin') || perms.includes('platform:admin');

  if (isStudent && !isStaff && !isPrincipalMobile && !isShiftAdmin && !isSuperAdmin) {
    return {
      persona: 'student',
      href: '/(student)/(tabs)' as Href,
      appType: 'student',
      title: 'Student Dashboard',
      subtitle: 'Attendance, academics, fees & more',
    };
  }

  if (isPrincipalMobile) {
    return {
      persona: 'principal',
      href: '/(principal)/(tabs)' as Href,
      appType: 'staff',
      title: 'Principal Command Center',
      subtitle: 'Institution overview, approvals & mail',
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
    title: 'Campus Portal',
    subtitle: 'No mobile portal access for this account',
  };
}

export function canAccessMobile(user: SessionUser): boolean {
  const perms = user.permissions ?? [];
  return (
    perms.includes('student:portal:self') ||
    perms.includes('staff:portal:self') ||
    perms.includes('principal-mobile:access') ||
    hasSchoolMobileAccess(user)
  );
}
