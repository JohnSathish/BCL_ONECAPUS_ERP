/** Public careers portal routes — no session required. */
export const CAREERS_PUBLIC_ROUTES = [
  '/careers-portal',
  '/careers-portal/jobs',
  '/careers-portal/apply',
  '/careers-portal/application-status',
] as const;

export function isCareersPublicPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  if (pathname.startsWith('/careers-portal/jobs/')) return true;
  return (CAREERS_PUBLIC_ROUTES as readonly string[]).includes(pathname);
}
