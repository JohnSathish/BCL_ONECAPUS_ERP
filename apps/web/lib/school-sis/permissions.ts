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
    'broadcast',
    'notifications',
    'whatsapp',
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
    'whatsapp',
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
): SchoolErpNavLink[] | undefined {
  if (!children) return children;
  const roleBlob = (roles ?? []).join(' ').toLowerCase();
  const cashierOnly = /cashier/.test(roleBlob) && !/admin|principal|super/.test(roleBlob);
  let next = canManage ? children : children.filter((c) => c.id !== 'student-add');
  if (cashierOnly) {
    next = next.filter((c) => c.id !== 'fee-gateways' && c.id !== 'fee-gateway-txns');
  }
  return next;
}

export function filterSchoolSisNavGroups(
  groups: SchoolSisNavGroup[],
  input: { permissions?: string[]; roles?: string[]; modules?: Record<string, boolean> },
): SchoolSisNavGroup[] {
  const persona = resolveSchoolSisNavPersona(input.permissions, input.roles);
  const canManage = canManageSchoolSis(input.permissions);
  const allowed = persona === 'full' ? null : PERSONA_MODULES[persona];

  return groups
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => !allowed || allowed.has(item.id))
        .map((item) => {
          const flagged = applyFeatureFlags(item, input.modules);
          return { ...flagged, children: filterChildren(flagged.children, canManage, input.roles) };
        }),
    }))
    .filter((group) => group.items.length > 0);
}
