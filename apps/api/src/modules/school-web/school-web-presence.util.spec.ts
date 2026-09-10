import {
  clampTimeoutMinutes,
  hashSchoolWebVisitor,
  isSchoolWebBotUserAgent,
  isSchoolWebSessionId,
  normalizePublicPath,
} from './school-web-presence.util';

describe('school web presence helpers', () => {
  it('rejects crawlers and empty user agents', () => {
    expect(isSchoolWebBotUserAgent(undefined)).toBe(true);
    expect(isSchoolWebBotUserAgent('Googlebot/2.1')).toBe(true);
    expect(isSchoolWebBotUserAgent('Mozilla/5.0 Chrome/120.0')).toBe(false);
  });

  it('accepts only UUID session ids', () => {
    expect(isSchoolWebSessionId('abc')).toBe(false);
    expect(isSchoolWebSessionId('3b12f1c8-5d4e-4a1b-9c2d-7e8f9a0b1c2d')).toBe(
      true,
    );
  });

  it('hashes the same session to the same visitor key', () => {
    const id = '3b12f1c8-5d4e-4a1b-9c2d-7e8f9a0b1c2d';
    expect(hashSchoolWebVisitor('salt', id)).toBe(
      hashSchoolWebVisitor('salt', id),
    );
    expect(hashSchoolWebVisitor('salt', id)).not.toBe(
      hashSchoolWebVisitor('salt', '4b12f1c8-5d4e-4a1b-9c2d-7e8f9a0b1c2d'),
    );
  });

  it('normalizes public paths and strips the school-site prefix', () => {
    expect(normalizePublicPath('/school-site/about?x=1')).toBe('/about');
    expect(normalizePublicPath('fees')).toBe('/fees');
  });

  it('clamps timeout to 5–30 minutes', () => {
    expect(clampTimeoutMinutes(10)).toBe(10);
    expect(clampTimeoutMinutes(1)).toBe(5);
    expect(clampTimeoutMinutes(90)).toBe(30);
  });
});
