import {
  APITXT_SEND_MSG_URL,
  apitxtTenDigit,
  buildApitxtFlowPayload,
  buildApitxtSendMsgUrl,
  isApitxtSendMsgSuccess,
} from './school-sis-apitxt-sms';

describe('Apitxt sendMsg', () => {
  it('builds the documented Send SMS query', () => {
    const url = buildApitxtSendMsgUrl({
      authkey: 'KEY',
      mobiles: '919999999999,9876543211',
      message: 'Fee reminder from St. Lukes',
      sender: 'stluke',
      route: '4',
      templateId: 'TMPL_1',
      peId: 'PE123',
      flash: 0,
      unicode: 0,
    });
    expect(url.origin + url.pathname).toBe(APITXT_SEND_MSG_URL);
    expect(url.searchParams.get('authkey')).toBe('KEY');
    expect(url.searchParams.get('mobiles')).toBe('9999999999,9876543211');
    expect(url.searchParams.get('message')).toBe('Fee reminder from St. Lukes');
    expect(url.searchParams.get('sender')).toBe('STLUKE');
    expect(url.searchParams.get('route')).toBe('4');
    expect(url.searchParams.get('template_id')).toBe('TMPL_1');
    expect(url.searchParams.get('pe_id')).toBe('PE123');
    expect(url.searchParams.get('flash')).toBe('0');
    expect(url.searchParams.get('unicode')).toBe('0');
    expect(url.searchParams.get('schtime')).toBeNull();
  });

  it('strips country code to 10-digit mobiles', () => {
    expect(apitxtTenDigit('919862512345')).toBe('9862512345');
    expect(apitxtTenDigit('+91 98625 12345')).toBe('9862512345');
    expect(apitxtTenDigit('09862512345')).toBe('9862512345');
  });

  it('treats status 200 / success as accepted', () => {
    expect(
      isApitxtSendMsgSuccess(
        { status: 200, message: 'success', request_id: 'SMS_a1b2c3d4e5' },
        true,
      ),
    ).toBe(true);
    expect(
      isApitxtSendMsgSuccess({ status: 'failed', message: 'no credits' }, true),
    ).toBe(false);
  });
});

describe('Apitxt sendFlow', () => {
  it('builds the documented JSON body with per-recipient variables', () => {
    const payload = buildApitxtFlowPayload({
      authkey: 'KEY',
      templateId: '1234567890',
      route: '4',
      recipients: [
        {
          mobiles: '919999999999',
          variables: { parent_name: 'John', amount: '500' },
        },
        {
          mobiles: '9876543211',
          variables: { name: 'Jane', amount: '750' },
        },
      ],
      flash: 0,
    });
    expect(payload.authkey).toBe('KEY');
    expect(payload.template_id).toBe('1234567890');
    expect(payload.route).toBe('4');
    expect(payload.flash).toBe(0);
    expect(payload.recipients).toEqual([
      {
        mobiles: '9999999999',
        variables: {
          parent_name: 'John',
          amount: '500',
          name: 'John',
          parent: 'John',
        },
      },
      {
        mobiles: '9876543211',
        variables: { name: 'Jane', amount: '750' },
      },
    ]);
  });
});
