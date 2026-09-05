import { DEFAULT_LOGIN_LOGO, resolveBrandingAssetUrl } from '@/lib/branding-asset';

/** Official Tura Public School emblem (public Next.js asset). */
export const SCHOOL_PORTAL_LOGO_SRC = '/school-admissions/tps-logo.png';
export const SCHOOL_PORTAL_BUILDING_SRC = '/school-admissions/tps-building-official.jpg';

export function resolveSchoolAwareLogoUrl(input?: {
  logoUrl?: string | null;
  institutionType?: string | null;
}): string {
  const uploaded = resolveBrandingAssetUrl(input?.logoUrl);
  if (uploaded) return uploaded;
  if (input?.institutionType === 'SCHOOL') return SCHOOL_PORTAL_LOGO_SRC;
  return DEFAULT_LOGIN_LOGO;
}

export function isSchoolErpHost(hostname?: string | null): boolean {
  const host = (hostname ?? '').split(':')[0]?.toLowerCase() ?? '';
  if (!host || host.startsWith('admissions.')) return false;
  if (host.startsWith('admission.')) return true;
  return (
    host === 'tps.localhost' ||
    host === 'turapublicschool.com' ||
    host.endsWith('.turapublicschool.com')
  );
}

export function isSchoolErpSession(input?: {
  tenantSlug?: string | null;
  institutionType?: string | null;
  hostname?: string | null;
}): boolean {
  if (input?.institutionType === 'SCHOOL') return true;
  if (input?.tenantSlug === 'tura-public-school') return true;
  return isSchoolErpHost(input?.hostname);
}

export function shouldSkipCollegeWorkspaceApis(
  pathname?: string | null,
  session?: { tenantSlug?: string | null } | null,
): boolean {
  if (pathname?.startsWith('/school-admissions-portal')) return true;
  return isSchoolErpSession({
    tenantSlug: session?.tenantSlug,
    hostname: typeof window !== 'undefined' ? window.location.hostname : undefined,
  });
}
