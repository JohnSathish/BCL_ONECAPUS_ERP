/**
 * School ERP RBAC scaffolding.
 * Module access is resolved from role → modules. Wire real checks when roles ship.
 */

import type { SchoolErpNavModule } from './nav';
import { SCHOOL_ERP_NAV } from './nav';

export type SchoolErpRole =
  | 'super_admin'
  | 'admission_officer'
  | 'accountant'
  | 'teacher'
  | 'principal'
  | 'hr_admin';

/** Module IDs each role may see when RBAC is enforced. */
export const SCHOOL_ERP_ROLE_MODULES: Record<SchoolErpRole, string[] | '*'> = {
  super_admin: '*',
  admission_officer: ['dashboard', 'admission-2027', 'reports'],
  accountant: ['dashboard', 'admission-2027', 'reports'],
  teacher: ['dashboard', 'academics'],
  principal: '*',
  hr_admin: ['dashboard', 'school-management', 'system'],
};

export function filterSchoolErpNavForRole(
  role: SchoolErpRole | null | undefined,
  nav: SchoolErpNavModule[] = SCHOOL_ERP_NAV,
): SchoolErpNavModule[] {
  if (!role) return nav;
  const allowed = SCHOOL_ERP_ROLE_MODULES[role];
  if (allowed === '*') return nav;
  return nav.filter((m) => allowed.includes(m.id));
}

export function canAccessSchoolErpModule(
  role: SchoolErpRole | null | undefined,
  moduleId: string,
): boolean {
  if (!role) return true;
  const allowed = SCHOOL_ERP_ROLE_MODULES[role];
  if (allowed === '*') return true;
  return allowed.includes(moduleId);
}
