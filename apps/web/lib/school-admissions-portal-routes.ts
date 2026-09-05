/** Public school admissions portal routes — no session required. */
export const SCHOOL_ADMISSIONS_PUBLIC_ROUTES = [
  '/school-admissions-portal',
  '/school-admissions-portal/login',
  '/school-admissions-portal/register',
  '/school-admissions-portal/forgot-password',
] as const;

export function isSchoolAdmissionsPublicPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return (SCHOOL_ADMISSIONS_PUBLIC_ROUTES as readonly string[]).includes(pathname);
}

export function isSchoolAdmissionsLoginPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return pathname === '/school-admissions-portal/login' || pathname === '/login';
}

export function isSchoolAdmissionHostName(host: string): boolean {
  const hostname = host.split(':')[0]?.toLowerCase() ?? '';
  if (hostname.startsWith('admissions.')) return false;
  return hostname === 'admission.turapublicschool.com' || hostname.startsWith('admission.');
}
