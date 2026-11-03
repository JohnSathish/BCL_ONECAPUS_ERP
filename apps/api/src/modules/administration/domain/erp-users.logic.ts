import {
  canAccessAdminPortal,
  isSuperAdmin,
} from '../../../common/permissions/permission-registry';

/**
 * Roles that belong to personal dashboards (student, staff, parent, applicant…)
 * or to other portals. An ERP account is an administrative login, so these are
 * never offered or accepted for it.
 */
export const NON_ERP_ROLE_SLUGS = new Set([
  'student',
  'parent',
  'parents',
  'guardian',
  'alumni',
  'applicant',
  'admissions-applicant',
  'faculty',
  'staff',
  'journal_author',
  'journal_reviewer',
  'library-operator',
  'fee-collection-center',
  'platform-admin',
]);

export const ERP_ADMINISTRATOR_ROLE_SLUGS = new Set([
  'college-admin',
  'super-admin',
  'university-admin',
  'institution-admin',
  'erp-administrator',
]);

export type ErpAccountStatus = 'active' | 'inactive' | 'locked';

export const ERP_ACCOUNT_STATUSES: readonly ErpAccountStatus[] = [
  'active',
  'inactive',
  'locked',
];

const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,39}$/;

export function normalizeErpUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Returns an error message, or null when the username is acceptable. */
export function erpUsernameProblem(username: string): string | null {
  if (!USERNAME_PATTERN.test(username)) {
    return 'Username must be 3–40 characters: letters, numbers, dot, dash or underscore, starting with a letter or number.';
  }
  if (username.includes('@')) return 'Username cannot contain @.';
  return null;
}

export function isRoleOfferedForErp(slug: string): boolean {
  return !NON_ERP_ROLE_SLUGS.has(slug) && !slug.startsWith('school-');
}

/**
 * Why this role cannot be given to an ERP account, or null when it can.
 * `rolePermissions` are the role's own permission slugs plus any extra grants.
 */
export function erpRoleProblem(
  slug: string,
  rolePermissions: string[],
): string | null {
  if (!isRoleOfferedForErp(slug)) {
    return 'This role is for a personal dashboard (student, staff, parent or applicant). Choose an ERP role.';
  }
  if (!canAccessAdminPortal([slug], rolePermissions)) {
    return 'This role does not open the ERP dashboard. Add ERP module permissions to it in Roles & Permissions first.';
  }
  return null;
}

/**
 * A non-super-admin may only hand out access they already hold, so creating an
 * ERP account can never raise anyone above the person creating it.
 */
export function escalationProblem(input: {
  actorRoles: string[];
  actorPermissions: string[];
  targetRoleSlug: string;
  targetPermissions: string[];
}): string | null {
  if (isSuperAdmin(input.actorRoles)) return null;
  if (isSuperAdmin([input.targetRoleSlug])) {
    return 'Only a Super Admin can assign a Super Admin role.';
  }
  const held = new Set(input.actorPermissions);
  const missing = input.targetPermissions.filter((p) => !held.has(p));
  if (missing.length) {
    return `You cannot grant permissions you do not hold yourself: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''}`;
  }
  return null;
}

export function nextErpAccountCode(existingCodes: string[]): string {
  let max = 0;
  for (const code of existingCodes) {
    const match = /^ERP-(\d+)$/.exec(code);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `ERP-${String(max + 1).padStart(4, '0')}`;
}

/** Login and per-request rule: null means the ERP account may use the ERP portal. */
export function erpAccessBlockReason(
  account: { erpAccessEnabled: boolean } | null | undefined,
  user: { isActive: boolean; accountStatus: string },
): string | null {
  if (!account) return null;
  if (!user.isActive || user.accountStatus === 'inactive') {
    return 'This ERP account has been deactivated. Please contact your administrator.';
  }
  if (user.accountStatus === 'locked') {
    return 'This ERP account is locked. Please contact your administrator.';
  }
  if (user.accountStatus !== 'active') {
    return 'This ERP account is not active. Please contact your administrator.';
  }
  if (!account.erpAccessEnabled) {
    return 'ERP dashboard access is turned off for this account. Please contact your administrator.';
  }
  return null;
}
