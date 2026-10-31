/** Keep in step with apps/api/src/common/permissions/library-qp-readonly.ts */
export const LIBRARY_QP_READONLY_ROLE = 'library-qp-readonly';

const RESTRICTED_EMAILS = new Set([
  'rehny@donboscocollege.ac.in',
  'threena@donboscocollege.ac.in',
  'stephen@donboscocollege.ac.in',
]);

const WRITABLE_PREFIX =
  /\/(?:library|question-bank)(?:\/|$)|\/auth\/(?:logout|refresh|change-password|permissions\/refresh|sessions\/revoke-all)(?:\/|$)|\/mfa\/(?:setup|verify-setup|disable|email-otp\/send|verify-login)(?:\/|$)|\/(?:export|download|print)(?:\/|$)|\/staff\/me(?:\/|$)|\/hr\/leave\/(?:applications\/me|summary\/me)(?:\/|$)|\/communication\/notifications(?:\/|$)|\/feedback\/me(?:\/|$)/;

export function restrictedStaffMayMutate(method: string, rawPath: string): boolean {
  const verb = method.toUpperCase();
  if (verb === 'GET' || verb === 'HEAD' || verb === 'OPTIONS') return true;
  const path = (rawPath.split('?')[0] ?? rawPath).replace(/\/+$/, '');
  return WRITABLE_PREFIX.test(path);
}

export function isLibraryQpReadonly(roles: string[] | undefined, email?: string): boolean {
  if ((roles ?? []).includes(LIBRARY_QP_READONLY_ROLE)) return true;
  return RESTRICTED_EMAILS.has((email ?? '').trim().toLowerCase());
}

export function libraryQpReadonlyPageIsWritable(pathname: string): boolean {
  return (
    pathname.startsWith('/admin/library') ||
    pathname.startsWith('/admin/academics/question-bank') ||
    pathname.startsWith('/library-desk')
  );
}
