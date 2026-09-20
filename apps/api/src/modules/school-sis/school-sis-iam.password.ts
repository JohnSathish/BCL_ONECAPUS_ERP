import { randomInt } from 'crypto';

/** Six-digit one-time PIN for school portal logins. Must be changed on first sign-in. */
export function generateSchoolPortalTempPassword(): string {
  return String(randomInt(100000, 1_000_000));
}
