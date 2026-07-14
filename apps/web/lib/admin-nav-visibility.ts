import type { NavChild, NavGroup, NavItem } from '@/config/navigation';
import {
  hasAllListedPermissions,
  hasAnyListedPermission,
  isSuperAdmin,
} from '@/lib/permissions/permission-registry';
import { canAccessAdminPortal, isStudentOnlyUser } from '@/lib/permissions/portal-access';
import { isOptionalLicenseModule, normalizeModuleKey } from '@/services/licensing';

export type AdminNavContext = {
  permissions: string[];
  roles: string[];
  /**
   * Licensed module keys currently enabled for the tenant.
   * `null` / `undefined` = skip entitlement gating (RBAC-only / loading / backward compat).
   */
  enabledModules?: string[] | null;
};

export function buildAdminNavContext(
  session?: {
    user?: { permissions?: string[]; roles?: string[] };
  },
  enabledModules?: string[] | null,
): AdminNavContext {
  return {
    permissions: session?.user?.permissions ?? [],
    roles: session?.user?.roles ?? [],
    enabledModules,
  };
}

function moduleEntitled(moduleId: string | undefined, ctx: AdminNavContext): boolean {
  if (ctx.enabledModules == null) return true;
  if (!moduleId) return true;
  // Core / non-optional modules stay visible under RBAC when entitlement list is present.
  if (!isOptionalLicenseModule(moduleId)) return true;
  const wanted = normalizeModuleKey(moduleId);
  return ctx.enabledModules.some((m) => normalizeModuleKey(m) === wanted);
}

function childVisible(
  child: NavChild,
  ctx: AdminNavContext,
  parentPermissions?: string[],
  parentRequireAll?: string[],
): boolean {
  if (child.requireAllPermissions?.length) {
    return hasAllListedPermissions(ctx.permissions, ctx.roles, child.requireAllPermissions);
  }
  if (child.permissions?.length) {
    return hasAnyListedPermission(ctx.permissions, ctx.roles, child.permissions);
  }
  // Inherit parent permissions — never allow-by-default for bare children.
  if (parentRequireAll?.length) {
    return hasAllListedPermissions(ctx.permissions, ctx.roles, parentRequireAll);
  }
  if (parentPermissions?.length) {
    return hasAnyListedPermission(ctx.permissions, ctx.roles, parentPermissions);
  }
  return isSuperAdmin(ctx.roles);
}

function filterNavItem(item: NavItem, ctx: AdminNavContext): NavItem | null {
  if (isStudentOnlyUser(ctx.roles) || !canAccessAdminPortal(ctx.roles, ctx.permissions)) {
    return null;
  }

  if (!moduleEntitled(item.module, ctx)) {
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
    const children = item.children.filter((child) =>
      childVisible(child, ctx, item.permissions, item.requireAllPermissions),
    );
    if (children.length === 0) return null;
    if (!itemAllowed) return null;
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
