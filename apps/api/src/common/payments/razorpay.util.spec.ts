import { createHmac } from 'crypto';
import {
  isRazorpayConfigured,
  verifyRazorpayPaymentSignature,
  verifyRazorpayWebhookSignature,
} from './razorpay.util';

describe('razorpay.util', () => {
  const creds = {
    keyId: 'rzp_test_key',
    keySecret: 'test_secret_key',
    webhookSecret: 'whsec_test',
  };

  describe('isRazorpayConfigured', () => {
    it('returns true when key id and secret are set', () => {
      expect(isRazorpayConfigured(creds)).toBe(true);
    });

    it('returns false when credentials are missing', () => {
      expect(isRazorpayConfigured({ keyId: '', keySecret: '' })).toBe(false);
      expect(isRazorpayConfigured(null)).toBe(false);
    });
  });

  describe('verifyRazorpayPaymentSignature', () => {
    it('accepts a valid order|payment signature', () => {
      const orderId = 'order_smoke123';
      const paymentId = 'pay_smoke456';
      const signature = createHmac('sha256', creds.keySecret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      expect(
        verifyRazorpayPaymentSignature(creds, orderId, paymentId, signature),
      ).toBe(true);
    });

    it('rejects an invalid signature', () => {
      expect(
        verifyRazorpayPaymentSignature(
          creds,
          'order_a',
          'pay_b',
          'bad-signature',
        ),
      ).toBe(false);
    });
  });

  describe('verifyRazorpayWebhookSignature', () => {
    it('accepts a valid webhook body signature', () => {
      const rawBody = JSON.stringify({
        event: 'payment.captured',
        payload: {},
      });
      const signature = createHmac('sha256', creds.webhookSecret!)
        .update(rawBody)
        .digest('hex');

      expect(verifyRazorpayWebhookSignature(creds, rawBody, signature)).toBe(
        true,
      );
    });

    it('falls back to key secret when webhook secret is omitted', () => {
      const rawBody = '{"event":"payment.captured"}';
      const signature = createHmac('sha256', creds.keySecret)
        .update(rawBody)
        .digest('hex');

      expect(
        verifyRazorpayWebhookSignature(
          { keyId: creds.keyId, keySecret: creds.keySecret },
          rawBody,
          signature,
        ),
      ).toBe(true);
    });
  });
});
