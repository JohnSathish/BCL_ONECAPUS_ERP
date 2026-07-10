import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { PaymentGatewayFactory } from '../payment-gateway.factory';
import { PaymentGatewayCredentialsService } from './payment-gateway-credentials.service';
import type {
  CheckoutSession,
  PaymentGatewayCredentials,
} from '../interfaces/payment-gateway.types';

@Injectable()
export class PaymentGatewayResolverService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly factory: PaymentGatewayFactory,
    private readonly credentials: PaymentGatewayCredentialsService,
  ) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  async getActiveGateway(tenantId: string) {
    const gateway = await this.db().tenantPaymentGateway.findFirst({
      where: { tenantId, isActive: true, status: 'ENABLED' },
      include: { provider: true },
    });
    if (!gateway) return null;
    return gateway;
  }

  async resolveCredentials(
    tenantId: string,
    providerCode?: string,
  ): Promise<PaymentGatewayCredentials | null> {
    const gateway = providerCode
      ? await this.db().tenantPaymentGateway.findFirst({
          where: { tenantId, providerCode: providerCode.toUpperCase() },
        })
      : await this.getActiveGateway(tenantId);

    if (gateway) {
      const creds = this.credentials.decryptCredentials(gateway);
      if (creds) return creds;
    }

    const code =
      providerCode?.toUpperCase() ?? gateway?.providerCode ?? 'RAZORPAY';
    return this.credentials.envFallback(code);
  }

  async resolveForCheckout(tenantId: string): Promise<{
    providerCode: string;
    credentials: PaymentGatewayCredentials | null;
    mode: string;
  }> {
    const active = await this.getActiveGateway(tenantId);
    if (active) {
      return {
        providerCode: active.providerCode,
        credentials: this.credentials.decryptCredentials(active),
        mode: active.mode,
      };
    }

    const envCreds = this.credentials.envFallback('RAZORPAY');
    if (envCreds) {
      return {
        providerCode: 'RAZORPAY',
        credentials: envCreds,
        mode: envCreds.mode,
      };
    }

    return { providerCode: 'RAZORPAY', credentials: null, mode: 'TEST' };
  }

  async createCheckoutOrder(
    tenantId: string,
    input: {
      amount: number;
      currency?: string;
      receipt: string;
      notes?: Record<string, string>;
    },
  ): Promise<CheckoutSession> {
    const { providerCode, credentials, mode } =
      await this.resolveForCheckout(tenantId);

    if (!credentials) {
      return {
        provider: providerCode as CheckoutSession['provider'],
        orderId: `MOCK-PENDING`,
        amount: input.amount,
        currency: input.currency ?? 'INR',
        mode: 'SAFE_MOCK',
      };
    }

    const adapter = this.factory.get(providerCode);
    if (!adapter.isConfigured(credentials)) {
      throw new BadRequestException(
        `Payment gateway ${providerCode} is not fully configured.`,
      );
    }

    const order = await adapter.createOrder(credentials, {
      amountPaise: Math.round(input.amount * 100),
      currency: input.currency ?? 'INR',
      receipt: input.receipt,
      notes: input.notes,
    });

    return {
      provider: providerCode as CheckoutSession['provider'],
      orderId: order.orderId,
      amount: input.amount,
      currency: input.currency ?? 'INR',
      keyId: credentials.keyId,
      mode: mode === 'LIVE' ? 'LIVE' : 'TEST',
      paymentSessionId: order.paymentSessionId,
      checkoutUrl: order.checkoutUrl,
      bdOrderId: order.bdOrderId,
      authToken: order.authToken,
      atomTokenId: order.atomTokenId,
      merchantId: credentials.merchantId ?? undefined,
    };
  }

  async verifyPayment(
    tenantId: string,
    providerCode: string,
    input: { orderId: string; paymentId: string; signature: string },
  ) {
    const creds = await this.resolveCredentials(tenantId, providerCode);
    if (!creds) {
      throw new BadRequestException('Payment gateway is not configured.');
    }
    const adapter = this.factory.get(providerCode);
    return adapter.verifyPayment(creds, input);
  }

  async verifyWebhook(
    tenantId: string,
    providerCode: string,
    rawBody: string,
    signature: string | undefined,
    context?: { timestamp?: string },
  ) {
    const creds = await this.resolveCredentials(tenantId, providerCode);
    if (!creds) {
      throw new BadRequestException('Payment gateway is not configured.');
    }
    const adapter = this.factory.get(providerCode);
    return adapter.verifyWebhook(creds, rawBody, signature, context);
  }

  async getAdapter(providerCode: string) {
    return this.factory.get(providerCode);
  }

  async requireActiveGateway(tenantId: string) {
    const gateway = await this.getActiveGateway(tenantId);
    if (!gateway) {
      const env = this.credentials.envFallback('RAZORPAY');
      if (env) {
        return {
          id: null,
          providerCode: 'RAZORPAY',
          mode: env.mode,
          status: 'ENABLED',
          isActive: true,
        };
      }
      throw new BadRequestException(
        'No active payment gateway configured. Configure one in Administration → Payment Gateway Management.',
      );
    }
    return gateway;
  }
}
