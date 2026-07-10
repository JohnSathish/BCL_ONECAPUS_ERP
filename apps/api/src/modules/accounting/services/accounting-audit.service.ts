import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class AccountingAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    tenantId: string,
    params?: { page?: number; limit?: number; entityType?: string },
  ) {
    const page = params?.page ?? 1;
    const limit = Math.min(params?.limit ?? 50, 200);
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      entityType: params?.entityType,
    };

    const [items, total] = await Promise.all([
      this.prisma.accountingAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.accountingAuditLog.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async log(input: {
    tenantId: string;
    entityType: string;
    entityId: string;
    action: string;
    actorId?: string;
    reason?: string;
    ipAddress?: string;
    before?: unknown;
    after?: unknown;
  }) {
    await this.prisma.accountingAuditLog.create({
      data: {
        tenantId: input.tenantId,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        actorId: input.actorId,
        reason: input.reason,
        ipAddress: input.ipAddress,
        before: input.before as object | undefined,
        after: input.after as object | undefined,
      },
    });
  }
}
