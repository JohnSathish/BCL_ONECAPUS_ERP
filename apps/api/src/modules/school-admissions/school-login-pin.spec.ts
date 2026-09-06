import {
  generateSchoolLoginPin,
  isSchoolLoginPin,
  normalizeSchoolLoginPin,
  SCHOOL_LOGIN_PIN_LENGTH,
} from './school-login-pin';

describe('school login PIN', () => {
  it('accepts exactly six digits', () => {
    expect(isSchoolLoginPin('365452')).toBe(true);
    expect(isSchoolLoginPin('000000')).toBe(true);
    expect(isSchoolLoginPin('36545')).toBe(false);
    expect(isSchoolLoginPin('3654527')).toBe(false);
    expect(isSchoolLoginPin('Tps3zh02z!')).toBe(false);
    expect(isSchoolLoginPin('36 5452')).toBe(false);
  });

  it('strips extra characters down to six digits', () => {
    expect(normalizeSchoolLoginPin('36a54b52c9')).toBe('365452');
    expect(SCHOOL_LOGIN_PIN_LENGTH).toBe(6);
  });

  it('generates a six-digit PIN', () => {
    const pin = generateSchoolLoginPin();
    expect(isSchoolLoginPin(pin)).toBe(true);
    expect(Number(pin)).toBeGreaterThanOrEqual(100000);
    expect(Number(pin)).toBeLessThanOrEqual(999999);
  });

  it('does not collide every time', () => {
    const seen = new Set(
      Array.from({ length: 8 }, () => generateSchoolLoginPin()),
    );
    expect(seen.size).toBeGreaterThan(1);
  });
});
