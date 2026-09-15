import { createHmac } from 'crypto';
import { verifyMetaSignature } from './school-sis-whatsapp.provider';

describe('Meta WhatsApp webhook signature', () => {
  it('rejects missing or mismatched signatures', () => {
    const secret = 'app-secret';
    const body = '{"object":"whatsapp_business_account"}';
    const good =
      'sha256=' +
      createHmac('sha256', secret).update(body, 'utf8').digest('hex');
    expect(verifyMetaSignature(secret, body, good)).toBe(true);
    expect(verifyMetaSignature(secret, body, 'sha256=deadbeef')).toBe(false);
    expect(verifyMetaSignature(secret, body, undefined)).toBe(false);
  });
});
