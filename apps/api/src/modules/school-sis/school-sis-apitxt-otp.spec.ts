import { buildApitxtOtpUrl, extractOtpCode } from './school-sis-apitxt-otp';

describe('Apitxt login OTP', () => {
  it('builds the documented sendOTP query', () => {
    const url = buildApitxtOtpUrl({
      authkey: 'KEY',
      mobile: '919999999999',
      otp: '4521',
      templateId: '42',
    });
    expect(url.origin + url.pathname).toBe('https://apitxt.com/api/sendOTP');
    expect(url.searchParams.get('authkey')).toBe('KEY');
    expect(url.searchParams.get('mobile')).toBe('919999999999');
    expect(url.searchParams.get('otp')).toBe('4521');
    expect(url.searchParams.get('template_id')).toBe('42');
    expect(url.searchParams.get('channel')).toBeNull();
  });

  it('adds WhatsApp channel and project when set', () => {
    const url = buildApitxtOtpUrl({
      authkey: 'KEY',
      mobile: '919999999999',
      otp: '4521',
      channel: 'whatsapp',
      templateName: 'verification_otp',
      projectRefId: 'PROJ_abc',
      country: '91',
    });
    expect(url.searchParams.get('channel')).toBe('whatsapp');
    expect(url.searchParams.get('template_name')).toBe('verification_otp');
    expect(url.searchParams.get('project_ref_id')).toBe('PROJ_abc');
    expect(url.searchParams.get('country')).toBe('91');
  });

  it('pulls the OTP digits from a login message', () => {
    expect(
      extractOtpCode(
        "St. Luke's School verification code: 482913. Do not share this code.",
      ),
    ).toBe('482913');
  });
});
