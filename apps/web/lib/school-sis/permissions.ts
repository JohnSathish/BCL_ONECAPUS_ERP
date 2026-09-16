import type { SchoolErpNavLink, SchoolErpNavModule } from '@/lib/school-erp/nav';
import type { SchoolSisNavGroup } from './nav';

const MANAGE = 'school-sis:manage';
const READ = 'school-sis:read';
const WEB_READ = 'website:read';

export type SchoolSisNavPersona =
  | 'full'
  | 'teacher'
  | 'accountant'
  | 'librarian'
  | 'transport'
  | 'read';

const PERSONA_MODULES: Record<Exclude<SchoolSisNavPersona, 'full'>, Set<string>> = {
  teacher: new Set([
    'dashboard',
    'academic-config',
    'application',
    'students',
    'classes-sections',
    'subjects-curriculum',
    'timetable',
    'learning',
    'examination',
    'holidays',
    'attendance',
    'hr-payroll',
    'broadcast',
    'notifications',
    'whatsapp',
    'sms',
    'automation',
    'cms-website',
    'documentation',
    'changelog',
    'support',
  ]),
  accountant: new Set([
    'dashboard',
    'students',
    'fees',
    'billing',
    'accounts',
    'hr-payroll',
    'whatsapp',
    'sms',
    'automation',
    'reports-analytics',
    'documentation',
    'support',
  ]),
  librarian: new Set([
    'dashboard',
    'students',
    'library',
    'reports-analytics',
    'documentation',
    'support',
  ]),
  transport: new Set([
    'dashboard',
    'students',
    'transport',
    'reports-analytics',
    'documentation',
    'support',
  ]),
  read: new Set([
    'dashboard',
    'students',
    'classes-sections',
    'academic-config',
    'application',
    'documentation',
    'support',
  ]),
};

function has(permissions: string[] | undefined, slug: string) {
  const list = permissions ?? [];
  return list.includes('*') || list.includes(slug);
}

export function resolveSchoolSisNavPersona(
  permissions?: string[],
  roles?: string[],
): SchoolSisNavPersona {
  const roleBlob = (roles ?? []).join(' ').toLowerCase();
  if (has(permissions, MANAGE)) return 'full';
  if (roleBlob.includes('hr') || has(permissions, 'hr.employees.manage')) return 'full';
  if (roleBlob.includes('accountant') || roleBlob.includes('accounts')) return 'accountant';
  if (roleBlob.includes('librarian')) return 'librarian';
  if (roleBlob.includes('transport')) return 'transport';
  if (roleBlob.includes('teacher')) return 'teacher';
  if (has(permissions, READ) || has(permissions, WEB_READ)) return 'teacher';
  return 'read';
}

export function canManageSchoolSis(permissions?: string[]) {
  return has(permissions, MANAGE);
}

export function canManageSchoolUsers(permissions?: string[]) {
  return (
    has(permissions, MANAGE) ||
    has(permissions, 'users:manage') ||
    has(permissions, 'users.create') ||
    has(permissions, 'users.update')
  );
}

export function canViewSchoolUsers(permissions?: string[]) {
  return (
    canManageSchoolUsers(permissions) ||
    has(permissions, 'users.view') ||
    has(permissions, 'users:read')
  );
}

export function canConfigureSchoolPaymentGateways(permissions?: string[], roles?: string[]) {
  if (!canManageSchoolSis(permissions)) return false;
  const roleBlob = (roles ?? []).join(' ').toLowerCase();
  if (/cashier/.test(roleBlob) && !/admin|principal|super/.test(roleBlob)) {
    return false;
  }
  return true;
}

function applyFeatureFlags(
  item: SchoolErpNavModule,
  modules?: Record<string, boolean>,
): SchoolErpNavModule {
  const flagMap: Record<string, string> = {
    timetable: 'timetable',
    attendance: 'attendance',
    examination: 'exams',
    fees: 'fees',
    billing: 'stationery',
    library: 'library',
    transport: 'transport',
  };
  const flag = flagMap[item.id];
  if (flag && modules && modules[flag] === false) {
    return {
      ...item,
      status: 'coming_soon',
      children: item.children?.map((c) => ({ ...c, status: 'coming_soon', href: undefined })),
    };
  }
  return item;
}

function filterChildren(
  children: SchoolErpNavLink[] | undefined,
  canManage: boolean,
  roles?: string[],
  persona?: SchoolSisNavPersona,
  permissions?: string[],
): SchoolErpNavLink[] | undefined {
  if (!children) return children;
  const roleBlob = (roles ?? []).join(' ').toLowerCase();
  const cashierOnly = /cashier/.test(roleBlob) && !/admin|principal|super/.test(roleBlob);
  let next = canManage ? children : children.filter((c) => c.id !== 'student-add');
  if (cashierOnly) {
    next = next.filter((c) => c.id !== 'fee-gateways' && c.id !== 'fee-gateway-txns');
  }
  const payroll = has(permissions, 'payroll.view') || has(permissions, 'payroll.calculate');
  const hrManage = has(permissions, MANAGE) || has(permissions, 'hr.employees.manage');
  if (persona === 'teacher' && !hrManage) {
    next = next.filter((c) =>
      ['hr-self', 'hr-leave-requests', 'hr-leave-balance', 'hr-attendance', 'hr-payslips'].includes(
        c.id,
      ),
    );
  } else if (persona === 'accountant' && !hrManage) {
    next = next.filter((c) =>
      [
        'hr-dashboard',
        'hr-employees',
        'hr-payroll-dash',
        'hr-process',
        'hr-register',
        'hr-payments',
        'hr-history',
        'hr-structures',
        'hr-components',
        'hr-assign',
        'hr-payslips',
        'hr-loans',
        'hr-reimb',
        'hr-reports',
      ].includes(c.id),
    );
  }
  if (!payroll && persona !== 'full' && !has(permissions, '*')) {
    next = next.filter(
      (c) =>
        ![
          'hr-payroll-dash',
          'hr-process',
          'hr-register',
          'hr-payments',
          'hr-history',
          'hr-structures',
          'hr-components',
          'hr-assign',
          'hr-revisions',
        ].includes(c.id),
    );
  }
  return next;
}

export function filterSchoolSisNavGroups(
  groups: SchoolSisNavGroup[],
  input: {
    permissions?: string[];
    roles?: string[];
    modules?: Record<string, boolean>;
    licenseModules?: string[];
  },
): SchoolSisNavGroup[] {
  const persona = resolveSchoolSisNavPersona(input.permissions, input.roles);
  const canManage = canManageSchoolSis(input.permissions);
  const allowed = persona === 'full' ? null : PERSONA_MODULES[persona];
  const usersOk = canViewSchoolUsers(input.permissions);
  const lic = input.licenseModules;

  return groups
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => {
          if (item.id === 'users' || item.id === 'account-security') return usersOk;
          if (item.id === 'system' && !canManage && !has(input.permissions, 'system.view'))
            return false;
          return !allowed || allowed.has(item.id);
        })
        .map((item) => {
          const flagged = applyFeatureFlags(item, input.modules);
          return {
            ...flagged,
            children: filterChildren(
              flagged.children,
              canManage,
              input.roles,
              persona,
              input.permissions,
            ),
          };
        })
        .filter((item) => {
          if (!lic?.length) return true;
          const need = LICENSE_NAV[item.id];
          return !need || lic.includes(need);
        }),
    }))
    .filter((group) => group.items.length > 0);
}

const LICENSE_NAV: Record<string, string> = {
  'academic-config': 'academic',
  students: 'students',
  teachers: 'staff',
  staff: 'staff',
  attendance: 'attendance',
  fees: 'fees',
  accounts: 'accounts',
  billing: 'fees',
  examination: 'examination',
  library: 'library',
  transport: 'transport',
  'hr-payroll': 'hr_payroll',
  sms: 'sms',
  whatsapp: 'whatsapp',
  notifications: 'notifications',
  automation: 'automation',
  'reports-analytics': 'reports',
  'mobile-app': 'mobile',
};
