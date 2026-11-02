import {
  accountRequiresAdminEmailOtp,
  buildAdminOtpMessage,
  checkOtpCode,
  hashOtpCode,
  maskEmail,
  otpHashesMatch,
  resendAllowed,
  selectOtpChannel,
} from './admin-email-otp.policy';

const now = new Date('2026-11-02T10:00:00.000Z');

describe('admin email OTP policy', () => {
  it('requires a code for an admin on a new device', () => {
    expect(
      accountRequiresAdminEmailOtp({
        roles: ['college-admin'],
        schoolTenant: false,
        trustedDevice: false,
      }),
    ).toBe('challenge');
  });

  it('skips the code when the admin device is already trusted', () => {
    expect(
      accountRequiresAdminEmailOtp({
        roles: ['super-admin'],
        schoolTenant: false,
        trustedDevice: true,
      }),
    ).toBe('skip');
  });

  it('keeps staff, faculty, students, librarians, and accountants on the existing login', () => {
    for (const roles of [
      ['faculty'],
      ['staff'],
      ['student'],
      ['librarian'],
      ['accountant'],
      ['principal'],
      ['library-operator'],
    ]) {
      expect(
        accountRequiresAdminEmailOtp({
          roles,
          schoolTenant: false,
          trustedDevice: false,
        }),
      ).toBe('skip');
    }
  });

  it('still challenges an account that also has a staff role when an admin role is present', () => {
    expect(
      accountRequiresAdminEmailOtp({
        roles: ['faculty', 'college-admin'],
        schoolTenant: false,
        trustedDevice: false,
      }),
    ).toBe('challenge');
  });

  it('does not challenge school tenants', () => {
    expect(
      accountRequiresAdminEmailOtp({
        roles: ['college-admin'],
        schoolTenant: true,
        trustedDevice: false,
      }),
    ).toBe('skip');
  });

  it('rejects a wrong code and an expired code', () => {
    expect(
      checkOtpCode({
        exists: true,
        consumed: false,
        expiresAt: new Date(now.getTime() + 60_000),
        attemptCount: 0,
        hashesMatch: false,
        now,
      }).ok,
    ).toBe(false);
    expect(
      checkOtpCode({
        exists: true,
        consumed: false,
        expiresAt: new Date(now.getTime() - 1),
        attemptCount: 0,
        hashesMatch: true,
        now,
      }),
    ).toEqual({ ok: false, reason: 'expired' });
  });

  it('rejects a used code and locks after five attempts', () => {
    expect(
      checkOtpCode({
        exists: true,
        consumed: true,
        expiresAt: new Date(now.getTime() + 60_000),
        attemptCount: 0,
        hashesMatch: true,
        now,
      }),
    ).toEqual({ ok: false, reason: 'used' });
    expect(
      checkOtpCode({
        exists: true,
        consumed: false,
        expiresAt: new Date(now.getTime() + 60_000),
        attemptCount: 5,
        hashesMatch: true,
        now,
      }),
    ).toEqual({ ok: false, reason: 'locked' });
  });

  it('stores a hash that is not the code, and a new hash does not match the previous code', () => {
    const first = hashOtpCode('123456', 'challenge-1', 'pepper');
    const resent = hashOtpCode('654321', 'challenge-1', 'pepper');
    expect(first).not.toBe('123456');
    expect(
      otpHashesMatch(first, hashOtpCode('123456', 'challenge-1', 'pepper')),
    ).toBe(true);
    expect(
      otpHashesMatch(resent, hashOtpCode('123456', 'challenge-1', 'pepper')),
    ).toBe(false);
  });

  it('holds resend for 60 seconds and then allows a replacement code', () => {
    const blocked = resendAllowed({
      exists: true,
      consumed: false,
      createdAt: now,
      lastSentAt: now,
      sendCount: 1,
      now,
    });
    expect(blocked.ok).toBe(false);
    const later = new Date(now.getTime() + 61_000);
    expect(
      resendAllowed({
        exists: true,
        consumed: false,
        createdAt: now,
        lastSentAt: now,
        sendCount: 1,
        now: later,
      }).ok,
    ).toBe(true);
  });

  it('masks the registered address and keeps the code out of the subject', () => {
    expect(maskEmail('admin@donboscocollege.ac.in')).toBe(
      'a***n@donboscocollege.ac.in',
    );
    const message = buildAdminOtpMessage({
      code: '482913',
      collegeName: 'Don Bosco College, Tura',
      displayName: 'Admin',
    });
    expect(message.subject.includes('482913')).toBe(false);
    expect(message.text.includes('482913')).toBe(true);
  });

  it('selects email for admins and no channel for other audiences', () => {
    expect(selectOtpChannel({ audience: 'admin' })).toBe('email');
    expect(selectOtpChannel({ audience: 'staff' })).toBeNull();
    expect(selectOtpChannel({ audience: 'student' })).toBeNull();
  });
});
