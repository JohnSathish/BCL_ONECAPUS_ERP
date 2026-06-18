/** Shared portal / route access rules — keep in sync with apps/web/lib/permissions/portal-access.ts */

import {
  canAccessAdminPortal as registryCanAccessAdmin,
  canAccessAdminRoute,
  canAccessPlatformPortal as registryCanAccessPlatform,
  resolveDefaultAdminHome,
} from './permission-registry';

export const ADMIN_PORTAL_ROLES = new Set([
  'college-admin',
  'super-admin',
  'university-admin',
  'institution-admin',
  'shift-admin',
  'shift-academic-coordinator',
  'shift-attendance-manager',
  'shift-examination-coordinator',
  'academic-admin',
  'admission-admin',
  'hod',
  'accountant',
  'librarian',
  'front-office-desk',
  'transport-coordinator',
  'store-keeper',
  'examination-cell',
  'registrar',
  'principal',
  'vice-principal',
  'erp-administrator',
  'hostel-warden',
]);

export const STAFF_PORTAL_ROLES = new Set(['faculty', 'staff']);

export const STUDENT_PORTAL_ROLES = new Set(['student']);

export const LIBRARY_DESK_ROLES = new Set(['library-operator']);

export const PRINCIPAL_DESK_ROLES = new Set([
  'principal',
  'vice-principal',
  'erp-administrator',
]);

export const PARENT_PORTAL_ROLES = new Set(['parent']);

export function canAccessLibraryDesk(
  roles: string[],
  permissions: string[] = [],
) {
  if (roles.some((role) => LIBRARY_DESK_ROLES.has(role))) return true;
  return permissions.includes('library:access-desk');
}

export function canAccessPrincipalDesk(
  roles: string[],
  permissions: string[] = [],
) {
  if (roles.some((role) => PRINCIPAL_DESK_ROLES.has(role))) return true;
  return permissions.includes('principal-desk:access');
}

export const PLATFORM_PORTAL_ROLES = new Set(['platform-admin']);

export function canAccessPlatformPortal(
  roles: string[],
  permissions: string[] = [],
) {
  return registryCanAccessPlatform(roles, permissions);
}

export function canAccessAdminPortal(
  roles: string[],
  permissions: string[] = [],
) {
  return registryCanAccessAdmin(roles, permissions);
}

export function canAccessStaffPortal(roles: string[]) {
  return roles.some((role) => STAFF_PORTAL_ROLES.has(role));
}

export function canAccessStudentPortal(roles: string[]) {
  return roles.some((role) => STUDENT_PORTAL_ROLES.has(role));
}

export function resolveHomePath(roles: string[], permissions: string[] = []) {
  if (
    roles.includes('platform-admin') ||
    (canAccessPlatformPortal(roles, permissions) &&
      !canAccessAdminPortal(roles, permissions))
  ) {
    return '/platform';
  }
  if (
    canAccessLibraryDesk(roles, permissions) &&
    !canAccessAdminPortal(roles, permissions)
  ) {
    return '/library-desk';
  }
  if (canAccessAdminPortal(roles, permissions)) {
    return resolveDefaultAdminHome(permissions, roles);
  }
  if (roles.some((r) => r.startsWith('shift-'))) return '/shift';
  if (canAccessStaffPortal(roles)) return '/staff/dashboard';
  if (canAccessStudentPortal(roles)) return '/student';
  if (roles.includes('parent')) return '/parent';
  return '/login';
}

export function canAccessPath(
  roles: string[],
  path: string,
  permissions: string[] = [],
) {
  if (!path.startsWith('/')) return false;
  if (path.startsWith('/platform')) {
    return canAccessPlatformPortal(roles, permissions);
  }
  if (path.startsWith('/admin')) {
    return canAccessAdminRoute(path, permissions, roles);
  }
  if (path.startsWith('/staff'))
    return (
      canAccessStaffPortal(roles) || canAccessAdminPortal(roles, permissions)
    );
  if (path.startsWith('/shift'))
    return (
      roles.some((r) => r.startsWith('shift-')) ||
      canAccessAdminPortal(roles, permissions)
    );
  if (path.startsWith('/student'))
    return (
      canAccessStudentPortal(roles) || canAccessAdminPortal(roles, permissions)
    );
  if (path.startsWith('/parent'))
    return roles.includes('parent') || canAccessAdminPortal(roles, permissions);
  if (path.startsWith('/accountant'))
    return (
      canAccessAdminPortal(roles, permissions) || roles.includes('accountant')
    );
  if (path.startsWith('/librarian'))
    return (
      canAccessAdminPortal(roles, permissions) || roles.includes('librarian')
    );
  if (path.startsWith('/library-desk')) {
    return (
      canAccessLibraryDesk(roles, permissions) ||
      canAccessAdminPortal(roles, permissions)
    );
  }
  if (path.startsWith('/principal-desk')) {
    return (
      canAccessPrincipalDesk(roles, permissions) ||
      canAccessAdminPortal(roles, permissions)
    );
  }
  return true;
}

export function sanitizeNotificationLink(
  roles: string[],
  link?: string | null,
  permissions: string[] = [],
) {
  if (!link?.trim()) return undefined;
  const normalized = link.trim();
  if (!normalized.startsWith('/')) return undefined;
  if (normalized.startsWith('//')) return undefined;
  if (canAccessPath(roles, normalized, permissions)) return normalized;
  return resolveHomePath(roles, permissions);
}
