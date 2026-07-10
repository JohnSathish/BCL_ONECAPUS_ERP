import { Injectable } from '@nestjs/common';
import {
  createBilldeskOrder,
  extractBilldeskCheckout,
  isBilldeskConfigured,
  retrieveBilldeskOrder,
  toBilldeskCredentials,
  verifyBilldeskPaymentReturn,
  verifyBilldeskWebhook,
} from '../../../common/payments/billdesk.util';
import type {
  CreateOrderInput,
  CreateOrderResult,
  PaymentGatewayAdapter,
  PaymentGatewayCredentials,
  VerifyPaymentInput,
} from '../interfaces/payment-gateway.types';

@Injectable()
export class BilldeskGatewayAdapter implements PaymentGatewayAdapter {
  readonly code = 'BILLDESK' as const;

  private creds(credentials: PaymentGatewayCredentials) {
    return toBilldeskCredentials({
      merchantId: credentials.merchantId,
      keyId: credentials.keyId,
      keySecret: credentials.keySecret,
      webhookSecret: credentials.webhookSecret,
      successUrl: credentials.successUrl,
      mode: credentials.mode,
    });
  }

  isConfigured(credentials: PaymentGatewayCredentials) {
    const creds = this.creds(credentials);
    return creds ? isBilldeskConfigured(creds) : false;
  }

  async testConnection(credentials: PaymentGatewayCredentials) {
    const started = Date.now();
    const creds = this.creds(credentials);
    if (!creds) {
      return {
        ok: false,
        message: 'Merchant ID, client ID, and signing key are required.',
      };
    }
    try {
      await createBilldeskOrder(creds, {
        orderId: `health-${Date.now()}`,
        amount: 1,
        notes: { healthCheck: 'true' },
      });
      return {
        ok: true,
        message: 'BillDesk connection successful.',
        latencyMs: Date.now() - started,
      };
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : 'BillDesk connection failed.',
        latencyMs: Date.now() - started,
      };
    }
  }

  async createOrder(
    credentials: PaymentGatewayCredentials,
    input: CreateOrderInput,
  ): Promise<CreateOrderResult> {
    const creds = this.creds(credentials);
    if (!creds) {
      throw new Error('BillDesk credentials are incomplete.');
    }
    const order = await createBilldeskOrder(creds, {
      orderId: input.receipt,
      amount: input.amountPaise / 100,
      currency: '356',
      returnUrl: credentials.successUrl ?? undefined,
      notes: input.notes,
    });
    const checkout = extractBilldeskCheckout(order);
    return {
      orderId: order.orderid,
      amount: input.amountPaise / 100,
      currency: input.currency,
      bdOrderId: checkout.bdOrderId ?? order.bdorderid,
      authToken: checkout.authToken,
      checkoutUrl: checkout.checkoutUrl,
      raw: order,
    };
  }

  async verifyPayment(
    credentials: PaymentGatewayCredentials,
    input: VerifyPaymentInput,
  ) {
    const creds = this.creds(credentials);
    if (!creds) return false;

    if (input.signature?.includes('.')) {
      return verifyBilldeskPaymentReturn(creds, input.signature, input.orderId);
    }

    try {
      const order = await retrieveBilldeskOrder(creds, input.orderId);
      const status = String(
        (order as { status?: string }).status ??
          (order as { transaction_error_type?: string })
            .transaction_error_type ??
          '',
      ).toLowerCase();
      return status === 'paid' || status === 'success' || status === '0300';
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
    return verifyBilldeskWebhook(creds, rawBody).valid;
  }
}
