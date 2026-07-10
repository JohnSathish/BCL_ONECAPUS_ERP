import { Injectable } from '@nestjs/common';
import {
  createNttDataAtomToken,
  isNttDataConfigured,
  toNttDataCredentials,
  trackNttDataTransaction,
  verifyNttDataReturnPayload,
} from '../../../common/payments/nttdata.util';
import type {
  CreateOrderInput,
  CreateOrderResult,
  PaymentGatewayAdapter,
  PaymentGatewayCredentials,
  VerifyPaymentInput,
} from '../interfaces/payment-gateway.types';

@Injectable()
export class NttDataGatewayAdapter implements PaymentGatewayAdapter {
  readonly code = 'NTT_DATA' as const;

  private creds(credentials: PaymentGatewayCredentials) {
    return toNttDataCredentials({
      merchantId: credentials.merchantId,
      keyId: credentials.keyId,
      keySecret: credentials.keySecret,
      webhookSecret: credentials.webhookSecret,
      mode: credentials.mode,
    });
  }

  isConfigured(credentials: PaymentGatewayCredentials) {
    const creds = this.creds(credentials);
    return creds ? isNttDataConfigured(creds) : false;
  }

  async testConnection(credentials: PaymentGatewayCredentials) {
    const started = Date.now();
    const creds = this.creds(credentials);
    if (!creds) {
      return {
        ok: false,
        message:
          'Merchant ID, encryption key, merchant password, and decryption key are required.',
      };
    }
    try {
      await createNttDataAtomToken(creds, {
        merchTxnId: `health-${Date.now()}`,
        amount: 1,
        udf: { healthCheck: 'true' },
      });
      return {
        ok: true,
        message: 'NTT DATA connection successful.',
        latencyMs: Date.now() - started,
      };
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : 'NTT DATA connection failed.',
        latencyMs: Date.now() - started,
      };
    }
  }

  async createOrder(
    credentials: PaymentGatewayCredentials,
    input: CreateOrderInput,
  ): Promise<CreateOrderResult> {
    const creds = this.creds(credentials);
    if (!creds) throw new Error('NTT DATA credentials are incomplete.');

    const auth = await createNttDataAtomToken(creds, {
      merchTxnId: input.receipt,
      amount: input.amountPaise / 100,
      currency: input.currency,
      returnUrl: credentials.successUrl ?? undefined,
      udf: input.notes,
    });

    if (
      auth.responseDetails?.txnStatusCode !== 'OTS0000' &&
      !auth.atomTokenId
    ) {
      throw new Error(
        auth.responseDetails?.txnDescription ??
          auth.responseDetails?.txnMessage ??
          'NTT DATA token generation failed.',
      );
    }

    return {
      orderId: input.receipt,
      amount: input.amountPaise / 100,
      currency: input.currency,
      atomTokenId: String(auth.atomTokenId ?? ''),
      raw: auth,
    };
  }

  async verifyPayment(
    credentials: PaymentGatewayCredentials,
    input: VerifyPaymentInput,
  ) {
    const creds = this.creds(credentials);
    if (!creds) return false;

    if (input.signature) {
      const verified = verifyNttDataReturnPayload(creds, input.signature);
      if (verified.valid) return true;
    }

    try {
      const status = await trackNttDataTransaction(creds, {
        merchTxnId: input.orderId,
        amount: Number(input.paymentId) || 0,
        txnDate: new Date().toISOString().slice(0, 10),
      });
      const code = String(
        (status as { statusCode?: string }).statusCode ??
          (status as { txnStatus?: string }).txnStatus ??
          '',
      ).toUpperCase();
      return code === 'OTS0000' || code === 'SUCCESS';
    } catch {
      return false;
    }
  }

  verifyWebhook(
    credentials: PaymentGatewayCredentials,
    rawBody: string,
    _signature: string | undefined,
    _context?: { timestamp?: string },
  ) {
    const creds = this.creds(credentials);
    if (!creds) return false;
    const enc = rawBody.includes('encData=')
      ? decodeURIComponent(rawBody.split('encData=')[1]?.split('&')[0] ?? '')
      : rawBody.trim();
    if (!enc) return false;
    return verifyNttDataReturnPayload(creds, enc).valid;
  }
}
