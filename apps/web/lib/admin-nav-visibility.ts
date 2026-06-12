import type { NavChild, NavGroup, NavItem } from '@/config/navigation';
import {
  hasAllListedPermissions,
  hasAnyListedPermission,
  isSuperAdmin,
} from '@/lib/permissions/permission-registry';
import { canAccessAdminPortal, isStudentOnlyUser } from '@/lib/permissions/portal-access';

export type AdminNavContext = {
  permissions: string[];
  roles: string[];
};

export function buildAdminNavContext(session?: {
  user?: { permissions?: string[]; roles?: string[] };
}): AdminNavContext {
  return {
    permissions: session?.user?.permissions ?? [],
    roles: session?.user?.roles ?? [],
  };
}

function childVisible(child: NavChild, ctx: AdminNavContext): boolean {
  if (child.requireAllPermissions?.length) {
    return hasAllListedPermissions(ctx.permissions, ctx.roles, child.requireAllPermissions);
  }
  if (child.permissions?.length) {
    return hasAnyListedPermission(ctx.permissions, ctx.roles, child.permissions);
  }
  return true;
}

function filterNavItem(item: NavItem, ctx: AdminNavContext): NavItem | null {
  if (isStudentOnlyUser(ctx.roles) || !canAccessAdminPortal(ctx.roles, ctx.permissions)) {
    return null;
  }

  if (item.soon && !item.permissions?.length) {
    return isSuperAdmin(ctx.roles) ? item : null;
  }

  const itemAllowed = item.requireAllPermissions?.length
    ? hasAllListedPermissions(ctx.permissions, ctx.roles, item.requireAllPermissions)
    : item.permissions?.length
      ? hasAnyListedPermission(ctx.permissions, ctx.roles, item.permissions)
      : isSuperAdmin(ctx.roles);

  if (!itemAllowed && !item.children?.length) return null;

  if (item.children?.length) {
    const children = item.children.filter((child) => childVisible(child, ctx));
    if (children.length === 0) return null;
    return { ...item, children };
  }

  return itemAllowed ? item : null;
}

export function filterAdminNav(groups: NavGroup[], ctx: AdminNavContext): NavGroup[] {
  return groups
    .map((group) => {
      const items = group.items
        .map((item) => filterNavItem(item, ctx))
        .filter(Boolean) as NavItem[];
      if (items.length === 0) return null;
      return { ...group, items };
    })
    .filter(Boolean) as NavGroup[];
}
