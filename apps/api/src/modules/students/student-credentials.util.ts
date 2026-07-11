/** Synthetic portal email when the college has not assigned a real address. */
export function syntheticStudentEmail(identifier: string): string {
  const key = identifier
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._+-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
  return `${key || 'student'}@students.local`;
}

export function isSyntheticStudentEmail(
  email: string | null | undefined,
): boolean {
  return Boolean(email?.trim().toLowerCase().endsWith('@students.local'));
}

/** Default first-login password: explicit → roll → enrollment → legacy fallback. */
export function resolveStudentDefaultPassword(opts: {
  password?: string | null;
  rollNumber?: string | null;
  enrollmentNumber?: string | null;
}): string {
  const explicit = opts.password?.trim();
  if (explicit) return explicit;
  const roll = opts.rollNumber?.trim();
  if (roll) return roll;
  const enroll = opts.enrollmentNumber?.trim();
  if (enroll) return enroll;
  return 'Student@123';
}

export function resolveStudentPortalEmail(opts: {
  email?: string | null;
  rollNumber?: string | null;
  enrollmentNumber?: string | null;
}): string {
  const email = opts.email?.trim().toLowerCase();
  if (email && email.includes('@')) return email;
  const id =
    opts.rollNumber?.trim() || opts.enrollmentNumber?.trim() || 'student';
  return syntheticStudentEmail(id);
}
