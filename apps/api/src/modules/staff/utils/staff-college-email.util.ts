/** Official staff mailbox domain for Don Bosco College Tura. */
export const COLLEGE_EMAIL_DOMAIN = 'donboscocollege.ac.in';

export function normalizeEmail(
  value: string | null | undefined,
): string | null {
  const email = value?.trim().toLowerCase() ?? '';
  if (!email || !email.includes('@')) return null;
  return email;
}

export function isOfficialCollegeEmail(
  value: string | null | undefined,
): boolean {
  const email = normalizeEmail(value);
  if (!email) return false;
  return email.endsWith(`@${COLLEGE_EMAIL_DOMAIN}`);
}

/**
 * First official college address among the candidates.
 * Personal addresses (Gmail and similar) are ignored.
 */
export function officialCollegeEmail(
  ...candidates: Array<string | null | undefined>
): string | null {
  for (const candidate of candidates) {
    if (isOfficialCollegeEmail(candidate)) return normalizeEmail(candidate);
  }
  return null;
}
