import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class PaymentGatewayWebhookLogService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  async record(input: {
    tenantId: string;
    gatewayId?: string | null;
    providerCode: string;
    eventName: string;
    payload: unknown;
    verificationStatus: string;
    processingStatus?: string;
    errorMessage?: string | null;
  }) {
    return this.db().paymentWebhookLog.create({
      data: {
        tenantId: input.tenantId,
        gatewayId: input.gatewayId ?? null,
        providerCode: input.providerCode.toUpperCase(),
        eventName: input.eventName,
        payload: input.payload as object,
        verificationStatus: input.verificationStatus,
        processingStatus: input.processingStatus ?? 'PENDING',
        errorMessage: input.errorMessage ?? null,
        processedAt: input.processingStatus === 'PROCESSED' ? new Date() : null,
      },
    });
  }

  async list(
    tenantId: string,
    query: {
      gateway?: string;
      processingStatus?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const where: Record<string, unknown> = { tenantId };
    if (query.gateway) where.providerCode = query.gateway.toUpperCase();
    if (query.processingStatus) where.processingStatus = query.processingStatus;

    const [items, total] = await Promise.all([
      this.db().paymentWebhookLog.findMany({
        where,
        orderBy: { receivedAt: 'desc' },
        take: query.limit ?? 50,
        skip: query.offset ?? 0,
      }),
      this.db().paymentWebhookLog.count({ where }),
    ]);

    return { total, items };
  }

  async markProcessed(id: string, tenantId: string, status: string) {
    return this.db().paymentWebhookLog.updateMany({
      where: { id, tenantId },
      data: {
        processingStatus: status,
        processedAt: new Date(),
      },
    });
  }

  async markReplayed(id: string, tenantId: string) {
    return this.db().paymentWebhookLog.updateMany({
      where: { id, tenantId },
      data: { replayedAt: new Date(), processingStatus: 'REPLAYED' },
    });
  }
}
