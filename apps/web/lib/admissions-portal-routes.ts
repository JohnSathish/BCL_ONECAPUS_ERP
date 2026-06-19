/** Public admissions portal routes — no session required. Keep in sync with middleware. */
export const ADMISSIONS_PUBLIC_ROUTES = [
  '/admissions-portal',
  '/admissions-portal/login',
  '/admissions-portal/register',
  '/admissions-portal/forgot-password',
] as const;

export function isAdmissionsPublicPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  if (pathname.startsWith('/admissions-portal/reset-password')) return true;
  return (ADMISSIONS_PUBLIC_ROUTES as readonly string[]).includes(pathname);
}

export function isAdmissionsLoginPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return pathname === '/admissions-portal/login' || pathname === '/login';
}
