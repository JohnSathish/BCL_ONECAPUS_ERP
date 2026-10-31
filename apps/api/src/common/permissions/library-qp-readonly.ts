/** Staff who may change only the library and the question-paper repository. */
export const LIBRARY_QP_READONLY_ROLE = 'library-qp-readonly';

export const LIBRARY_QP_READONLY_EMAILS = [
  'rehny@donboscocollege.ac.in',
  'threena@donboscocollege.ac.in',
  'stephen@donboscocollege.ac.in',
] as const;

const RESTRICTED_EMAILS = new Set<string>(LIBRARY_QP_READONLY_EMAILS);

export function isRestrictedLibraryStaff(
  roles: string[] | undefined,
  email: string | undefined,
): boolean {
  if ((roles ?? []).includes(LIBRARY_QP_READONLY_ROLE)) return true;
  return RESTRICTED_EMAILS.has((email ?? '').trim().toLowerCase());
}

export const LIBRARY_FULL_PERMISSIONS = [
  'library:read',
  'library:manage',
  'library:circulate',
  'library:reports',
  'library:settings',
  'library:access-desk',
  'library:digital:read',
  'library:digital:download',
  'library:digital:manage',
  'library:research:read',
  'library:research:submit',
  'library:research:manage',
] as const;

export const QUESTION_PAPER_FULL_PERMISSIONS = [
  'question-bank:read',
  'question-bank:manage',
  'question-bank:contribute',
  'question-bank:approve',
  'question-bank:publish',
] as const;

const VIEW_PERMISSION = /:(read|view|download|reports)$/;
const BLOCKED_VIEW = new Set(['backup:download', 'backup:read']);

export function isViewPermission(slug: string): boolean {
  if (BLOCKED_VIEW.has(slug)) return false;
  return VIEW_PERMISSION.test(slug);
}

/** Full library and question papers, plus view permissions from the catalogue. */
export function libraryQpReadonlyPermissions(
  catalog: readonly string[],
): string[] {
  const views = catalog.filter((slug) => isViewPermission(slug));
  return [
    ...new Set([
      ...LIBRARY_FULL_PERMISSIONS,
      ...QUESTION_PAPER_FULL_PERMISSIONS,
      ...views,
      'staff:portal:self',
      'notifications:read',
    ]),
  ];
}

const WRITABLE_PREFIX =
  /\/(?:library|question-bank)(?:\/|$)|\/auth\/(?:logout|refresh|change-password|permissions\/refresh|sessions\/revoke-all)(?:\/|$)|\/mfa\/(?:setup|verify-setup|disable|email-otp\/send|verify-login)(?:\/|$)|\/(?:export|download|print)(?:\/|$)|\/staff\/me(?:\/|$)|\/hr\/leave\/(?:applications\/me|summary\/me)(?:\/|$)|\/communication\/notifications(?:\/|$)|\/feedback\/me(?:\/|$)/;

/** True when this account may send a request that changes data. */
export function restrictedStaffMayMutate(
  method: string,
  rawPath: string,
): boolean {
  const verb = method.toUpperCase();
  if (verb === 'GET' || verb === 'HEAD' || verb === 'OPTIONS') return true;
  const path = (rawPath.split('?')[0] ?? rawPath).replace(/\/+$/, '');
  return WRITABLE_PREFIX.test(path);
}
