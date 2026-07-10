import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class PaymentGatewayAuditService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  async log(input: {
    tenantId: string;
    gatewayId?: string | null;
    actorId?: string | null;
    action: string;
    before?: unknown;
    after?: unknown;
    ipAddress?: string | null;
  }) {
    await this.db().paymentGatewayConfigAudit.create({
      data: {
        tenantId: input.tenantId,
        gatewayId: input.gatewayId ?? null,
        actorId: input.actorId ?? null,
        action: input.action,
        before: input.before ?? undefined,
        after: input.after ?? undefined,
        ipAddress: input.ipAddress ?? null,
      },
    });
  }

  async list(tenantId: string, limit = 50) {
    return this.db().paymentGatewayConfigAudit.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
