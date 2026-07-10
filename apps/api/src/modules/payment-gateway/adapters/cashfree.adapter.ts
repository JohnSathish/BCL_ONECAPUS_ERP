import { Injectable } from '@nestjs/common';
import {
  createCashfreeOrder,
  fetchCashfreeOrder,
  fetchCashfreeOrderPayments,
  isCashfreeConfigured,
  verifyCashfreePaymentSignature,
  verifyCashfreeWebhookSignature,
} from '../../../common/payments/cashfree.util';
import type {
  CreateOrderInput,
  CreateOrderResult,
  PaymentGatewayAdapter,
  PaymentGatewayCredentials,
  VerifyPaymentInput,
} from '../interfaces/payment-gateway.types';

@Injectable()
export class CashfreeGatewayAdapter implements PaymentGatewayAdapter {
  readonly code = 'CASHFREE' as const;

  private creds(credentials: PaymentGatewayCredentials) {
    return {
      keyId: credentials.keyId,
      keySecret: credentials.keySecret,
      webhookSecret: credentials.webhookSecret ?? undefined,
      mode: credentials.mode,
    };
  }

  isConfigured(credentials: PaymentGatewayCredentials) {
    return isCashfreeConfigured(this.creds(credentials));
  }

  async testConnection(credentials: PaymentGatewayCredentials) {
    const started = Date.now();
    if (!this.isConfigured(credentials)) {
      return { ok: false, message: 'App ID and secret key are required.' };
    }
    try {
      await createCashfreeOrder(this.creds(credentials), {
        amountPaise: 100,
        currency: 'INR',
        receipt: `health-${Date.now()}`,
        notes: { healthCheck: 'true' },
      });
      return {
        ok: true,
        message: 'Cashfree connection successful.',
        latencyMs: Date.now() - started,
      };
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : 'Cashfree connection failed.',
        latencyMs: Date.now() - started,
      };
    }
  }

  async createOrder(
    credentials: PaymentGatewayCredentials,
    input: CreateOrderInput,
  ): Promise<CreateOrderResult> {
    const order = await createCashfreeOrder(this.creds(credentials), {
      amountPaise: input.amountPaise,
      currency: input.currency,
      receipt: input.receipt,
      notes: input.notes,
      returnUrl: credentials.successUrl ?? undefined,
    });
    return {
      orderId: order.order_id,
      amount: input.amountPaise / 100,
      currency: input.currency,
      paymentSessionId: order.payment_session_id,
      raw: order,
    };
  }

  async verifyPayment(
    credentials: PaymentGatewayCredentials,
    input: VerifyPaymentInput,
  ) {
    const creds = this.creds(credentials);
    if (
      input.signature &&
      verifyCashfreePaymentSignature(
        creds,
        input.orderId,
        input.paymentId,
        input.signature,
      )
    ) {
      return true;
    }
    try {
      const order = await fetchCashfreeOrder(creds, input.orderId);
      if (order.order_status !== 'PAID') return false;
      if (!input.paymentId) return true;
      const payments = await fetchCashfreeOrderPayments(creds, input.orderId);
      return payments.some(
        (p) =>
          p.cf_payment_id === input.paymentId && p.payment_status === 'SUCCESS',
      );
    } catch {
      return false;
    }
  }

  verifyWebhook(
    credentials: PaymentGatewayCredentials,
    rawBody: string,
    signature: string | undefined,
    context?: { timestamp?: string },
  ) {
    if (!signature) return false;
    return verifyCashfreeWebhookSignature(
      this.creds(credentials),
      rawBody,
      signature,
      context?.timestamp,
    );
  }
}
