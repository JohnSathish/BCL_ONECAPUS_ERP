import { maskMobile, normalizeInMobile } from './school-sis-sms.phone';

export type SchoolActivationContact = {
  kind: 'SMS' | 'EMAIL';
  masked: string;
  mobile?: string;
  email?: string;
};

export function isSchoolPlaceholderEmail(email?: string | null) {
  const value = email?.trim().toLowerCase() ?? '';
  if (!value.includes('@')) return true;
  if (value.includes('@invalid.')) return true;
  if (value.endsWith('@portal.stlukestura.in')) return true;
  return /^(student|staff|teacher)\.[a-z0-9]+@(?:[a-z0-9-]+\.)*stlukestura\.in$/.test(
    value,
  );
}

export function realSchoolEmail(email?: string | null) {
  const value = email?.trim().toLowerCase() ?? '';
  if (!value.includes('@') || isSchoolPlaceholderEmail(value)) return null;
  return value;
}

export function maskSchoolEmail(email: string) {
  const [user, domain] = email.split('@');
  if (!user || !domain) return '*****';
  return `${user.slice(0, 1)}*****@${domain}`;
}

/** Prefer the student master phone/email over the generated login User. */
export function pickSchoolActivationContact(input: {
  studentPhone?: string | null;
  studentEmail?: string | null;
  userPhone?: string | null;
  userEmail?: string | null;
}): SchoolActivationContact | null {
  const mobile =
    normalizeInMobile(input.studentPhone) || normalizeInMobile(input.userPhone);
  if (mobile) {
    return { kind: 'SMS', masked: maskMobile(mobile), mobile };
  }
  const email =
    realSchoolEmail(input.studentEmail) || realSchoolEmail(input.userEmail);
  if (email) {
    return { kind: 'EMAIL', masked: maskSchoolEmail(email), email };
  }
  return null;
}
