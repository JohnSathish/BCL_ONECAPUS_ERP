import {
  isSchoolPortalBotUserAgent,
  isSchoolPortalSessionId,
  schoolPortalClientIp,
  schoolPortalVisitorKey,
} from './school-portal-presence.util';

describe('school portal presence helpers', () => {
  it('rejects empty and crawler user agents', () => {
    expect(isSchoolPortalBotUserAgent(undefined)).toBe(true);
    expect(isSchoolPortalBotUserAgent('')).toBe(true);
    expect(isSchoolPortalBotUserAgent('Googlebot/2.1')).toBe(true);
    expect(isSchoolPortalBotUserAgent('Mozilla/5.0 Chrome/120.0')).toBe(false);
  });

  it('accepts only UUID session ids', () => {
    expect(isSchoolPortalSessionId('not-a-uuid')).toBe(false);
    expect(
      isSchoolPortalSessionId('3b12f1c8-5d4e-4a1b-9c2d-7e8f9a0b1c2d'),
    ).toBe(true);
  });

  it('hashes the same IP and UA to the same visitor key', () => {
    const a = schoolPortalVisitorKey('salt', '1.2.3.4', 'Mozilla/5.0');
    const b = schoolPortalVisitorKey('salt', '1.2.3.4', 'Mozilla/5.0');
    const c = schoolPortalVisitorKey('salt', '1.2.3.5', 'Mozilla/5.0');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toHaveLength(64);
  });

  it('prefers the first forwarded IP', () => {
    expect(
      schoolPortalClientIp(
        { 'x-forwarded-for': '10.0.0.8, 10.0.0.1' },
        '127.0.0.1',
      ),
    ).toBe('10.0.0.8');
  });
});
