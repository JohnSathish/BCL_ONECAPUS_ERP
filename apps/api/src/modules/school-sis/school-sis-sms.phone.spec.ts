import {
  extractVariables,
  hashOtp,
  missingVariables,
  normalizeInMobile,
  renderSms,
  smsSegments,
} from './school-sis-sms.phone';

describe('school SMS helpers', () => {
  it('normalizes Indian mobiles to 91XXXXXXXXXX', () => {
    expect(normalizeInMobile('98625 12345')).toBe('919862512345');
    expect(normalizeInMobile('+91 9862512345')).toBe('919862512345');
    expect(normalizeInMobile('123')).toBeNull();
  });

  it('counts GSM vs unicode segments', () => {
    expect(smsSegments('Hello school').segments).toBe(1);
    expect(smsSegments('₹').unicode).toBe(true);
    expect(smsSegments('x'.repeat(161)).segments).toBe(2);
  });

  it('renders and validates template variables', () => {
    const body = 'Dear {parent_name}, {amount} for {student_name}';
    expect(extractVariables(body)).toEqual([
      'parent_name',
      'amount',
      'student_name',
    ]);
    expect(
      renderSms(body, {
        parent_name: 'Mary',
        amount: 3600,
        student_name: 'Adrian',
      }),
    ).toContain('Mary');
    expect(missingVariables(body, { parent_name: 'Mary' })).toEqual([
      'amount',
      'student_name',
    ]);
  });

  it('hashes OTPs without storing the code', () => {
    const a = hashOtp('t', 'LOGIN', '9198', '123456');
    const b = hashOtp('t', 'LOGIN', '9198', '123456');
    const c = hashOtp('t', 'LOGIN', '9198', '000000');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).not.toContain('123456');
  });
});
