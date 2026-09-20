import { generateSchoolPortalTempPassword } from './school-sis-iam.password';

describe('generateSchoolPortalTempPassword', () => {
  it('returns a 6-digit numeric PIN', () => {
    for (let i = 0; i < 20; i += 1) {
      const pin = generateSchoolPortalTempPassword();
      expect(pin).toMatch(/^\d{6}$/);
    }
  });

  it('does not include punctuation or mixed case', () => {
    const pin = generateSchoolPortalTempPassword();
    expect(pin).not.toMatch(/[^0-9]/);
  });
});
