import {
  ERP_MODULES,
  SUPER_ADMIN_ROLES,
  type ErpModule,
} from '@/lib/permissions/permission-registry';
import type { PermissionRow } from '@/types/administration';

export type ModuleAccessLevel = 'full' | 'view' | 'none';

export type QuickAssignRole = {
  slug: string;
  label: string;
  description?: string;
  templateSlug?: string;
};

/** One-click roles for college administrators. */
export const QUICK_ASSIGN_ROLES: QuickAssignRole[] = [
  { slug: 'super-admin', label: 'Super Admin', description: 'Full unrestricted ERP access' },
  { slug: 'principal', label: 'Principal', templateSlug: 'principal' },
  { slug: 'vice-principal', label: 'Vice Principal', templateSlug: 'vice-principal' },
  { slug: 'hod', label: 'HOD', templateSlug: 'hod' },
  { slug: 'faculty', label: 'Faculty', templateSlug: 'faculty' },
  { slug: 'accountant', label: 'Finance Officer', templateSlug: 'accountant' },
  { slug: 'librarian', label: 'Librarian', templateSlug: 'librarian' },
  {
    slug: 'examination-cell',
    label: 'Exam Controller',
    templateSlug: 'examination-cell',
  },
  { slug: 'registrar', label: 'Registrar' },
  { slug: 'student', label: 'Student' },
  { slug: 'parent', label: 'Parent' },
];

export const SUPER_ADMIN_PROMOTE_MODULES = [
  'Students',
  'Staff',
  'Finance',
  'Library',
  'Reports',
  'Settings',
] as const;

const WRITE_ACTION_HINTS = [
  'manage',
  'admin',
  'collect',
  'process',
  'import',
  'approve',
  'create',
  'edit',
  'delete',
  'restore',
  'activate',
  'circulate',
  'issue',
  'assign',
];

const ACTION_LABELS: Record<string, string> = {
  read: 'View',
  view: 'View',
  manage: 'Manage',
  admin: 'Admin',
  import: 'Import',
  export: 'Export',
  collect: 'Collect',
  circulate: 'Circulate',
  approve: 'Approve',
  create: 'Create',
  edit: 'Edit',
  delete: 'Delete',
  reports: 'Reports',
  desk: 'Desk access',
  'cash:collect': 'Collect fee',
  'permission-overrides': 'Overrides',
};

export function isSuperAdminRole(slugs: string[]): boolean {
  return slugs.some((s) => (SUPER_ADMIN_ROLES as readonly string[]).includes(s));
}

export function getModuleAccessLevel(
  module: ErpModule,
  effectivePermissions: Set<string>,
  isSuperAdmin: boolean,
): ModuleAccessLevel {
  if (isSuperAdmin) return 'full';

  const modulePerms = module.permissions;
  const granted = modulePerms.filter((p) => effectivePermissions.has(p));
  if (!granted.length) return 'none';

  const hasWrite = granted.some((slug) => {
    const tail = slug.split(':').slice(1).join(':');
    return WRITE_ACTION_HINTS.some((hint) => tail.includes(hint));
  });

  return hasWrite ? 'full' : 'view';
}

export function buildModuleAccessSummary(
  effectivePermissions: string[],
  roleSlugs: string[],
): { module: ErpModule; level: ModuleAccessLevel }[] {
  const set = new Set(effectivePermissions);
  const superAdmin = isSuperAdminRole(roleSlugs);

  return ERP_MODULES.map((module) => ({
    module,
    level: getModuleAccessLevel(module, set, superAdmin),
  })).filter(({ level }) => level !== 'none');
}

export function humanizePermissionAction(slug: string): string {
  const action = slug.split(':').slice(1).join(':');
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];

  const lastSegment = action.split(':').pop() ?? action;
  if (ACTION_LABELS[lastSegment]) return ACTION_LABELS[lastSegment];

  return lastSegment
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export type ModulePermissionGroup = {
  module: ErpModule;
  permissions: PermissionRow[];
};

export function groupPermissionsByModule(permissions: PermissionRow[]): ModulePermissionGroup[] {
  const slugToPerm = new Map(permissions.map((p) => [p.slug, p]));
  const assigned = new Set<string>();

  const grouped: ModulePermissionGroup[] = ERP_MODULES.map((module) => {
    const perms = module.permissions
      .map((slug) => slugToPerm.get(slug))
      .filter((p): p is PermissionRow => Boolean(p));
    perms.forEach((p) => assigned.add(p.slug));
    return { module, permissions: perms };
  }).filter((g) => g.permissions.length > 0);

  const other = permissions.filter((p) => !assigned.has(p.slug));
  if (other.length) {
    grouped.push({
      module: {
        id: 'other-permissions',
        label: 'Other permissions',
        permissions: [],
        defaultHome: '/admin',
      },
      permissions: other.sort((a, b) => a.slug.localeCompare(b.slug)),
    });
  }

  return grouped;
}

export function moduleAccessLabel(level: ModuleAccessLevel): string {
  if (level === 'full') return 'Full access';
  if (level === 'view') return 'View only';
  return 'No access';
}

export function moduleAccessTone(level: ModuleAccessLevel): string {
  if (level === 'full') return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
  if (level === 'view') return 'bg-amber-500/15 text-amber-800 dark:text-amber-300';
  return 'bg-muted text-muted-foreground';
}

export function primaryRoleLabel(slugs: string[], names: string[]): string {
  if (!names.length) return 'No role assigned';
  const superIdx = slugs.findIndex((s) => (SUPER_ADMIN_ROLES as readonly string[]).includes(s));
  if (superIdx >= 0) return names[superIdx] ?? 'Super Admin';
  return names[0] ?? '—';
}
