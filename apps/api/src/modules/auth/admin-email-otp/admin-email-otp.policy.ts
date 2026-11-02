import { createHmac, randomInt, timingSafeEqual } from 'crypto';

/**
 * College ERP administrator roles. Librarians, accountants, faculty, staff,
 * and students are intentionally absent: phase 1 does not ask them for an OTP.
 * SMS for those accounts is a later phase and is not selected here.
 */
export const ADMIN_EMAIL_OTP_ROLES = new Set([
  'super-admin',
  'college-admin',
  'institution-admin',
  'university-admin',
  'erp-administrator',
  'platform-admin',
]);

export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_RESEND_MS = 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_MAX_SENDS = 5;
export const OTP_SEND_WINDOW_MS = 15 * 60 * 1000;
export const TRUSTED_DEVICE_MS = 30 * 24 * 60 * 60 * 1000;

export type OtpDeliveryChannel = 'email' | 'sms';

export type OtpDecision = 'skip' | 'challenge';

export function accountRequiresAdminEmailOtp(input: {
  roles: string[];
  schoolTenant: boolean;
  trustedDevice: boolean;
}): OtpDecision {
  if (input.schoolTenant) return 'skip';
  const roles = input.roles.map((role) => role.toLowerCase());
  const isAdmin = roles.some((role) => ADMIN_EMAIL_OTP_ROLES.has(role));
  if (!isAdmin) return 'skip';
  if (input.trustedDevice) return 'skip';
  return 'challenge';
}

/**
 * Phase 1 always delivers the admin code by email.
 * A later phase can return `sms` for staff and students from this same function
 * without changing the login session step.
 */
export function selectOtpChannel(input: {
  audience: 'admin' | 'staff' | 'student' | 'other';
}): OtpDeliveryChannel | null {
  if (input.audience !== 'admin') return null;
  return 'email';
}

export function generateOtpCode() {
  return randomInt(0, 1_000_000).toString().padStart(OTP_LENGTH, '0');
}

export function hashOtpCode(code: string, challengeId: string, pepper: string) {
  return createHmac('sha256', pepper)
    .update(`${challengeId}:${code.trim()}`)
    .digest('hex');
}

export function otpHashesMatch(storedHex: string, presentedHex: string) {
  const left = Buffer.from(storedHex, 'hex');
  const right = Buffer.from(presentedHex, 'hex');
  if (left.length === 0 || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function maskEmail(email: string) {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.indexOf('@');
  if (at <= 0) return 'your registered email';
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at);
  if (local.length <= 2) return `${local.slice(0, 1)}***${domain}`;
  return `${local.slice(0, 1)}***${local.slice(-1)}${domain}`;
}

export function describeClientDevice(userAgent?: string) {
  const ua = userAgent ?? '';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Chrome\//.test(ua)
      ? 'Chrome'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Safari\//.test(ua)
          ? 'Safari'
          : 'Browser';
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /Mac OS|Macintosh/.test(ua)
      ? 'Mac'
      : /Android/.test(ua)
        ? 'Android'
        : /iPhone|iPad/.test(ua)
          ? 'iOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'this device';
  return `${browser} on ${os}`.slice(0, 80);
}

export type OtpCheckResult =
  | { ok: true }
  | {
      ok: false;
      reason: 'missing' | 'used' | 'expired' | 'locked' | 'mismatch';
    };

export function checkOtpCode(input: {
  exists: boolean;
  consumed: boolean;
  expiresAt: Date;
  attemptCount: number;
  hashesMatch: boolean;
  now: Date;
}): OtpCheckResult {
  if (!input.exists) return { ok: false, reason: 'missing' };
  if (input.consumed) return { ok: false, reason: 'used' };
  if (input.expiresAt.getTime() <= input.now.getTime()) {
    return { ok: false, reason: 'expired' };
  }
  if (input.attemptCount >= OTP_MAX_ATTEMPTS) {
    return { ok: false, reason: 'locked' };
  }
  if (!input.hashesMatch) return { ok: false, reason: 'mismatch' };
  return { ok: true };
}

export function resendAllowed(input: {
  exists: boolean;
  consumed: boolean;
  createdAt: Date;
  lastSentAt: Date;
  sendCount: number;
  now: Date;
}): { ok: true } | { ok: false; retryAfterSeconds?: number; reason: string } {
  if (!input.exists || input.consumed) {
    return {
      ok: false,
      reason: 'This verification session has ended. Sign in again.',
    };
  }
  if (input.now.getTime() - input.createdAt.getTime() > OTP_SEND_WINDOW_MS) {
    return {
      ok: false,
      reason: 'This verification session has ended. Sign in again.',
    };
  }
  if (input.sendCount >= OTP_MAX_SENDS) {
    return {
      ok: false,
      reason:
        'Too many codes were sent. Wait about 15 minutes, then sign in again.',
    };
  }
  const waitMs =
    input.lastSentAt.getTime() + OTP_RESEND_MS - input.now.getTime();
  if (waitMs > 0) {
    return {
      ok: false,
      retryAfterSeconds: Math.ceil(waitMs / 1000),
      reason: 'Wait a minute before requesting another code.',
    };
  }
  return { ok: true };
}

export function buildAdminOtpMessage(input: {
  code: string;
  collegeName: string;
  displayName?: string | null;
}) {
  const who = input.displayName?.trim() || 'Administrator';
  const college = input.collegeName.trim() || 'Bosco Connect';
  const subject = `${college} admin sign-in code`;
  const text = [
    `Hello ${who},`,
    '',
    `Your Bosco Connect admin verification code is ${input.code}.`,
    'It expires in 5 minutes and can be used once.',
    'If you did not try to sign in, you can ignore this email.',
  ].join('\n');
  return { subject, text };
}
