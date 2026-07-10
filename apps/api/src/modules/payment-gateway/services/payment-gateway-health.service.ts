import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { PaymentGatewayFactory } from '../payment-gateway.factory';
import { PaymentGatewayCredentialsService } from './payment-gateway-credentials.service';

@Injectable()
export class PaymentGatewayHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly factory: PaymentGatewayFactory,
    private readonly credentials: PaymentGatewayCredentialsService,
  ) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  async checkTenant(tenantId: string) {
    const gateways = await this.db().tenantPaymentGateway.findMany({
      where: { tenantId, status: 'ENABLED' },
      include: { provider: true },
    });

    const results = [];
    for (const gateway of gateways) {
      const creds = this.credentials.decryptCredentials(gateway);
      let status = 'OFFLINE';
      let message = 'Not configured';
      let latencyMs: number | undefined;

      if (creds) {
        const adapter = this.factory.get(gateway.providerCode);
        const result = await adapter.testConnection(creds);
        status = result.ok ? 'ONLINE' : 'DEGRADED';
        message = result.message;
        latencyMs = result.latencyMs;
      }

      await this.db().tenantPaymentGateway.update({
        where: { id: gateway.id },
        data: {
          lastHealthAt: new Date(),
          lastHealthStatus: status,
        },
      });

      results.push({
        gatewayId: gateway.id,
        providerCode: gateway.providerCode,
        name: gateway.provider?.name ?? gateway.providerCode,
        isActive: gateway.isActive,
        mode: gateway.mode,
        status,
        message,
        latencyMs,
        lastCheckedAt: new Date().toISOString(),
      });
    }

    return results;
  }

  async testGateway(tenantId: string, providerCode: string) {
    const gateway = await this.db().tenantPaymentGateway.findFirst({
      where: { tenantId, providerCode: providerCode.toUpperCase() },
    });
    if (!gateway) {
      return {
        ok: false,
        message: 'Gateway not configured for this institution.',
      };
    }
    const creds = this.credentials.decryptCredentials(gateway);
    if (!creds) {
      return {
        ok: false,
        message: 'Credentials are missing or could not be decrypted.',
      };
    }
    const adapter = this.factory.get(providerCode);
    const result = await adapter.testConnection(creds);
    await this.db().tenantPaymentGateway.update({
      where: { id: gateway.id },
      data: {
        lastHealthAt: new Date(),
        lastHealthStatus: result.ok ? 'ONLINE' : 'DEGRADED',
      },
    });
    return result;
  }
}
