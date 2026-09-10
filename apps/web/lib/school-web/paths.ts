import { isSchoolWebPublicHost } from './hosts';

/** Strip the Next.js app prefix so public URLs stay `/about`, not `/school-site/about`. */
export function schoolPublicPath(href: string) {
  if (!href || /^(https?:|mailto:|tel:|#)/i.test(href)) return href;
  if (href.startsWith('/school-site')) {
    const rest = href.slice('/school-site'.length);
    return rest || '/';
  }
  return href.startsWith('/') ? href : `/${href}`;
}

/**
 * Public school hosts (school.localhost / stlukestura.in) use clean paths.
 * The office ERP host keeps `/school-site` so `/about` is not stolen by college routes.
 */
export function schoolWebPath(href: string, host?: string | null) {
  if (!href || /^(https?:|mailto:|tel:|#)/i.test(href)) return href;
  const path = schoolPublicPath(href);
  const resolved = (host || (typeof window !== 'undefined' ? window.location.host : '')).split(
    '/',
  )[0];
  if (isSchoolWebPublicHost(resolved)) return path;
  return path === '/' ? '/school-site' : `/school-site${path}`;
}
