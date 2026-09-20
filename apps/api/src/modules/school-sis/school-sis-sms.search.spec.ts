import {
  collectGatewayConfigIssues,
  enrollmentSearchWhere,
  formatClassLabel,
  providerSendsTransactionalSms,
  sanitizeSmsError,
} from './school-sis-sms.search';

describe('school SMS student search', () => {
  it('requires at least two characters', () => {
    expect(enrollmentSearchWhere('A')).toBeNull();
    expect(enrollmentSearchWhere('  ')).toBeNull();
  });

  it('searches name, admission, roll, class, and mobile', () => {
    const where = enrollmentSearchWhere('VIII A');
    expect(where?.OR).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          student: expect.objectContaining({
            fullName: expect.objectContaining({ contains: 'VIII A' }),
          }),
        }),
        expect.objectContaining({
          student: expect.objectContaining({
            admissionNumber: expect.objectContaining({ contains: 'VIII A' }),
          }),
        }),
        expect.objectContaining({
          rollNumber: expect.objectContaining({ contains: 'VIII A' }),
        }),
        expect.objectContaining({
          AND: expect.any(Array),
        }),
      ]),
    );
  });

  it('matches guardian and student mobiles on 10-digit needles', () => {
    const where = enrollmentSearchWhere('9862512345');
    const or = where?.OR ?? [];
    expect(or).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          student: { phone: { contains: '9862512345' } },
        }),
        expect.objectContaining({
          student: {
            guardians: {
              some: { guardian: { phone: { contains: '9862512345' } } },
            },
          },
        }),
      ]),
    );
  });

  it('formats class labels', () => {
    expect(formatClassLabel('Nursery', 'A')).toBe('Nursery A');
  });
});

describe('school SMS config helpers', () => {
  it('treats Apitxt as OTP-only', () => {
    expect(providerSendsTransactionalSms('APITXT')).toBe(false);
    expect(providerSendsTransactionalSms('MSG91')).toBe(true);
  });

  it('lists missing gateway fields without echoing secrets', () => {
    const issues = collectGatewayConfigIssues({
      provider: 'MSG91',
      status: 'ACTIVE',
      creds: {},
      senderId: null,
      defaultSenderId: null,
    });
    expect(issues.join(' ')).toContain('authkey');
    expect(issues.join(' ')).toContain('Sender ID');
    expect(issues.join(' ')).not.toMatch(/sk_|key-|secret/i);
  });

  it('redacts credentials from gateway errors', () => {
    const cleaned = sanitizeSmsError(
      'Failed authkey=abc123secret token=xyz https://control.msg91.com/api?authkey=abc123secret',
    );
    expect(cleaned).not.toContain('abc123secret');
    expect(cleaned.toLowerCase()).toContain('[redacted]');
  });
});
