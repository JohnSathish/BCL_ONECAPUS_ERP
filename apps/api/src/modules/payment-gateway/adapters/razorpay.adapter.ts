import { Injectable } from '@nestjs/common';
import {
  createRazorpayOrder,
  isRazorpayConfigured,
  verifyRazorpayPaymentSignature,
  verifyRazorpayWebhookSignature,
} from '../../../common/payments/razorpay.util';
import type {
  CreateOrderInput,
  CreateOrderResult,
  PaymentGatewayAdapter,
  PaymentGatewayCredentials,
  VerifyPaymentInput,
} from '../interfaces/payment-gateway.types';

@Injectable()
export class RazorpayGatewayAdapter implements PaymentGatewayAdapter {
  readonly code = 'RAZORPAY' as const;

  isConfigured(credentials: PaymentGatewayCredentials) {
    return isRazorpayConfigured({
      keyId: credentials.keyId,
      keySecret: credentials.keySecret,
    });
  }

  async testConnection(credentials: PaymentGatewayCredentials) {
    const started = Date.now();
    if (!this.isConfigured(credentials)) {
      return { ok: false, message: 'API key and secret are required.' };
    }
    try {
      await createRazorpayOrder(
        {
          keyId: credentials.keyId,
          keySecret: credentials.keySecret,
          webhookSecret: credentials.webhookSecret ?? undefined,
        },
        {
          amountPaise: 100,
          currency: 'INR',
          receipt: `health-${Date.now()}`,
          notes: { healthCheck: 'true' },
        },
      );
      return {
        ok: true,
        message: 'Razorpay connection successful.',
        latencyMs: Date.now() - started,
      };
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : 'Razorpay connection failed.',
        latencyMs: Date.now() - started,
      };
    }
  }

  async createOrder(
    credentials: PaymentGatewayCredentials,
    input: CreateOrderInput,
  ): Promise<CreateOrderResult> {
    const order = await createRazorpayOrder(
      {
        keyId: credentials.keyId,
        keySecret: credentials.keySecret,
        webhookSecret: credentials.webhookSecret ?? undefined,
      },
      input,
    );
    return {
      orderId: order.id,
      amount: input.amountPaise / 100,
      currency: input.currency,
      raw: order,
    };
  }

  verifyPayment(
    credentials: PaymentGatewayCredentials,
    input: VerifyPaymentInput,
  ) {
    return verifyRazorpayPaymentSignature(
      { keyId: credentials.keyId, keySecret: credentials.keySecret },
      input.orderId,
      input.paymentId,
      input.signature,
    );
  }

  verifyWebhook(
    credentials: PaymentGatewayCredentials,
    rawBody: string,
    signature: string | undefined,
    _context?: { timestamp?: string },
  ) {
    return verifyRazorpayWebhookSignature(
      {
        keyId: credentials.keyId,
        keySecret: credentials.keySecret,
        webhookSecret: credentials.webhookSecret ?? undefined,
      },
      rawBody,
      signature ?? '',
    );
  }
}
