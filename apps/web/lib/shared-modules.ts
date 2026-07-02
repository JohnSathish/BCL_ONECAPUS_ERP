/**
 * Admin routes that operate at institution level — workspace shift header is not sent.
 */
const SHARED_MODULE_PREFIXES = [
  '/admin/principal',
  '/admin/governance',
  '/admin/library',
  '/admin/hr',
  '/admin/inventory',
  '/admin/assets',
  '/admin/transport',
  '/admin/hostel',
  '/admin/recruitment',
  '/admin/careers',
  '/admin/shifts',
  '/admin/organization',
  '/admin/settings',
  '/admin/licensing',
  '/admin/platform',
  '/admin/naac',
  '/admin/iqac',
  '/admin/front-office',
  '/admin/official-documents',
  '/admin/administration/users',
  '/admin/administration/roles',
  '/admin/academic-engine/course-master',
  '/admin/academics/programmes',
  '/admin/academics/programs',
] as const;

export function isSharedAdminRoute(pathname: string): boolean {
  if (!pathname.startsWith('/admin')) return false;
  return SHARED_MODULE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function shouldAttachWorkspaceShiftHeader(pathname?: string): boolean {
  if (!pathname) return true;
  return !isSharedAdminRoute(pathname);
}
