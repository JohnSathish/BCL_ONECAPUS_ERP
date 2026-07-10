import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import type { ConfigureGatewayDto } from '../dto/payment-gateway.dto';
import { PaymentGatewayAuditService } from './payment-gateway-audit.service';
import { PaymentGatewayCredentialsService } from './payment-gateway-credentials.service';

@Injectable()
export class PaymentGatewayManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credentials: PaymentGatewayCredentialsService,
    private readonly audit: PaymentGatewayAuditService,
  ) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  async ensureTenantGateways(tenantId: string) {
    const providers = await this.db().paymentGatewayProvider.findMany({
      where: { isAvailable: true },
      orderBy: { sortOrder: 'asc' },
    });

    const activeCount = await this.db().tenantPaymentGateway.count({
      where: { tenantId, isActive: true },
    });
    const razorpayEnv = this.credentials.envFallback('RAZORPAY');
    const razorpayEncrypted = razorpayEnv
      ? this.credentials.encryptFields({
          apiKey: razorpayEnv.keyId,
          secretKey: razorpayEnv.keySecret,
          webhookSecret: razorpayEnv.webhookSecret,
        })
      : null;

    for (const provider of providers) {
      const isRazorpay = provider.code === 'RAZORPAY';
      const shouldBootstrapRazorpay =
        isRazorpay && activeCount === 0 && Boolean(razorpayEncrypted);

      await this.db().tenantPaymentGateway.upsert({
        where: {
          tenantId_providerCode: {
            tenantId,
            providerCode: provider.code,
          },
        },
        create: {
          tenantId,
          providerId: provider.id,
          providerCode: provider.code,
          status: shouldBootstrapRazorpay ? 'ENABLED' : 'DISABLED',
          mode: razorpayEnv?.mode ?? 'TEST',
          isActive: shouldBootstrapRazorpay,
          ...(shouldBootstrapRazorpay && razorpayEncrypted
            ? {
                apiKeyEncrypted: razorpayEncrypted.apiKeyEncrypted,
                secretKeyEncrypted: razorpayEncrypted.secretKeyEncrypted,
                webhookSecretEncrypted:
                  razorpayEncrypted.webhookSecretEncrypted,
              }
            : {}),
        },
        update: {},
      });
    }

    if (activeCount === 0) {
      const razorpay = await this.db().tenantPaymentGateway.findFirst({
        where: { tenantId, providerCode: 'RAZORPAY' },
      });
      const creds = razorpay
        ? this.credentials.decryptCredentials(razorpay)
        : null;
      if (razorpay && creds) {
        await this.db().tenantPaymentGateway.updateMany({
          where: { tenantId, isActive: true },
          data: { isActive: false },
        });
        await this.db().tenantPaymentGateway.update({
          where: { id: razorpay.id },
          data: { isActive: true, status: 'ENABLED' },
        });
      }
    }
  }

  async listGateways(tenantId: string) {
    await this.ensureTenantGateways(tenantId);
    const rows = await this.db().tenantPaymentGateway.findMany({
      where: { tenantId },
      include: { provider: true },
      orderBy: { provider: { sortOrder: 'asc' } },
    });

    return rows.map((row: Record<string, unknown>) => {
      const creds = this.credentials.decryptCredentials(
        row as Parameters<
          PaymentGatewayCredentialsService['decryptCredentials']
        >[0],
      );
      return {
        id: row.id,
        providerCode: row.providerCode,
        name: (row.provider as { name?: string })?.name ?? row.providerCode,
        description: (row.provider as { description?: string })?.description,
        status: row.status,
        mode: row.mode,
        isActive: row.isActive,
        merchantId: row.merchantId,
        successUrl: row.successUrl,
        failureUrl: row.failureUrl,
        lastHealthAt: row.lastHealthAt,
        lastHealthStatus: row.lastHealthStatus,
        configured: Boolean(creds),
        apiKeyMasked: this.credentials.maskSecret(creds?.keyId),
        secretKeyMasked: this.credentials.maskSecret(creds?.keySecret),
        webhookSecretMasked: this.credentials.maskSecret(creds?.webhookSecret),
      };
    });
  }

  async getActiveGateway(tenantId: string) {
    const gateways = await this.listGateways(tenantId);
    return gateways.find((g: { isActive: boolean }) => g.isActive) ?? null;
  }

  async configure(
    user: JwtUser,
    providerCode: string,
    dto: ConfigureGatewayDto,
    ipAddress?: string,
  ) {
    await this.ensureTenantGateways(user.tid);
    const code = providerCode.toUpperCase();
    const existing = await this.db().tenantPaymentGateway.findFirst({
      where: { tenantId: user.tid, providerCode: code },
    });
    if (!existing) throw new NotFoundException('Gateway not found.');

    const encrypted = this.credentials.encryptFields({
      apiKey: dto.apiKey,
      secretKey: dto.secretKey,
      webhookSecret: dto.webhookSecret,
    });

    const updated = await this.db().tenantPaymentGateway.update({
      where: { id: existing.id },
      data: {
        merchantId: dto.merchantId ?? existing.merchantId,
        successUrl: dto.successUrl ?? existing.successUrl,
        failureUrl: dto.failureUrl ?? existing.failureUrl,
        mode: dto.mode ?? existing.mode,
        status: dto.status ?? existing.status,
        configuredById: user.sub,
        ...(dto.apiKey ? { apiKeyEncrypted: encrypted.apiKeyEncrypted } : {}),
        ...(dto.secretKey
          ? { secretKeyEncrypted: encrypted.secretKeyEncrypted }
          : {}),
        ...(dto.webhookSecret
          ? { webhookSecretEncrypted: encrypted.webhookSecretEncrypted }
          : {}),
      },
      include: { provider: true },
    });

    await this.audit.log({
      tenantId: user.tid,
      gatewayId: updated.id,
      actorId: user.sub,
      action: 'CONFIGURE',
      before: {
        status: existing.status,
        mode: existing.mode,
        merchantId: existing.merchantId,
      },
      after: {
        status: updated.status,
        mode: updated.mode,
        merchantId: updated.merchantId,
      },
      ipAddress,
    });

    return this.listGateways(user.tid);
  }

  async activate(user: JwtUser, providerCode: string, ipAddress?: string) {
    const code = providerCode.toUpperCase();
    const gateway = await this.db().tenantPaymentGateway.findFirst({
      where: { tenantId: user.tid, providerCode: code },
    });
    if (!gateway) throw new NotFoundException('Gateway not found.');
    if (gateway.status !== 'ENABLED') {
      throw new BadRequestException(
        'Enable and configure the gateway before activating it.',
      );
    }
    const creds = this.credentials.decryptCredentials(gateway);
    if (!creds) {
      throw new BadRequestException(
        'Gateway credentials are required before activation.',
      );
    }

    await this.db().tenantPaymentGateway.updateMany({
      where: { tenantId: user.tid, isActive: true },
      data: { isActive: false },
    });

    const updated = await this.db().tenantPaymentGateway.update({
      where: { id: gateway.id },
      data: { isActive: true },
    });

    await this.audit.log({
      tenantId: user.tid,
      gatewayId: updated.id,
      actorId: user.sub,
      action: 'ACTIVATE',
      after: { providerCode: code },
      ipAddress,
    });

    return this.listGateways(user.tid);
  }

  async deactivate(user: JwtUser, providerCode: string, ipAddress?: string) {
    const code = providerCode.toUpperCase();
    const gateway = await this.db().tenantPaymentGateway.findFirst({
      where: { tenantId: user.tid, providerCode: code },
    });
    if (!gateway) throw new NotFoundException('Gateway not found.');

    const updated = await this.db().tenantPaymentGateway.update({
      where: { id: gateway.id },
      data: { isActive: false },
    });

    await this.audit.log({
      tenantId: user.tid,
      gatewayId: updated.id,
      actorId: user.sub,
      action: 'DEACTIVATE',
      after: { providerCode: code },
      ipAddress,
    });

    return this.listGateways(user.tid);
  }

  async setStatus(
    user: JwtUser,
    providerCode: string,
    status: 'ENABLED' | 'DISABLED',
    ipAddress?: string,
  ) {
    const code = providerCode.toUpperCase();
    const gateway = await this.db().tenantPaymentGateway.findFirst({
      where: { tenantId: user.tid, providerCode: code },
    });
    if (!gateway) throw new NotFoundException('Gateway not found.');

    const updated = await this.db().tenantPaymentGateway.update({
      where: { id: gateway.id },
      data: {
        status,
        ...(status === 'DISABLED' ? { isActive: false } : {}),
      },
    });

    await this.audit.log({
      tenantId: user.tid,
      gatewayId: updated.id,
      actorId: user.sub,
      action: status === 'ENABLED' ? 'ENABLE' : 'DISABLE',
      ipAddress,
    });

    return this.listGateways(user.tid);
  }
}
