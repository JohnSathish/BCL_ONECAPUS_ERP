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

/**
 * Canonical contact email for display across mobile, admin profile, and directory.
 * Prefer StudentProfile.email; fall back to User.email (login) when profile is empty/synthetic.
 */
export function resolveStudentContactEmail(
  profileEmail: string | null | undefined,
  loginEmail: string | null | undefined,
): string | null {
  const profile = profileEmail?.trim() || null;
  if (profile && !isSyntheticStudentEmail(profile)) {
    return profile;
  }
  const login = loginEmail?.trim() || null;
  if (login && !isSyntheticStudentEmail(login)) {
    return login;
  }
  return profile ?? login;
}

/** Compact roll/enrollment for tolerant matching (BA25-888 ≈ BA25888 ≈ ba25_888). */
export function compactStudentId(value: string | null | undefined): string {
  return (value ?? '')
    .trim()
    .replace(/[\s\-_.]/g, '')
    .toUpperCase();
}

export function studentIdsMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const left = compactStudentId(a);
  const right = compactStudentId(b);
  return Boolean(left && right && left === right);
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
