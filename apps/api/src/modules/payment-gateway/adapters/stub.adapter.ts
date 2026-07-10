import { Injectable } from '@nestjs/common';
import type {
  CreateOrderInput,
  CreateOrderResult,
  PaymentGatewayAdapter,
  PaymentGatewayCode,
  PaymentGatewayCredentials,
  VerifyPaymentInput,
} from '../interfaces/payment-gateway.types';

@Injectable()
export class StubGatewayAdapter implements PaymentGatewayAdapter {
  constructor(readonly code: PaymentGatewayCode) {}

  isConfigured(credentials: PaymentGatewayCredentials) {
    return Boolean(credentials.keyId?.trim() && credentials.keySecret?.trim());
  }

  async testConnection(_credentials: PaymentGatewayCredentials) {
    return {
      ok: false,
      message: `${this.code} adapter is registered but not yet implemented. Configure credentials for future use.`,
    };
  }

  async createOrder(
    _credentials: PaymentGatewayCredentials,
    _input: CreateOrderInput,
  ): Promise<CreateOrderResult> {
    throw new Error(`${this.code} payment initiation is not yet implemented.`);
  }

  verifyPayment(
    _credentials: PaymentGatewayCredentials,
    _input: VerifyPaymentInput,
  ) {
    return false;
  }

  verifyWebhook(
    _credentials: PaymentGatewayCredentials,
    _rawBody: string,
    _signature: string | undefined,
    _context?: { timestamp?: string },
  ) {
    return false;
  }
}
