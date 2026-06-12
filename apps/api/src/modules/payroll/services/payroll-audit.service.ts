import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

export type PayrollAuditInput = {
  tenantId: string;
  entityType: string;
  entityId?: string;
  action: string;
  oldValue?: unknown;
  newValue?: unknown;
  userId?: string;
};

@Injectable()
export class PayrollAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: PayrollAuditInput) {
    return this.prisma.payrollAuditLog.create({
      data: {
        tenantId: input.tenantId,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        oldValue:
          input.oldValue != null ? (input.oldValue as object) : undefined,
        newValue:
          input.newValue != null ? (input.newValue as object) : undefined,
        userId: input.userId,
      },
    });
  }

  list(
    tenantId: string,
    query?: { entityType?: string; entityId?: string; limit?: number },
  ) {
    return this.prisma.payrollAuditLog.findMany({
      where: {
        tenantId,
        ...(query?.entityType ? { entityType: query.entityType } : {}),
        ...(query?.entityId ? { entityId: query.entityId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: query?.limit ?? 200,
    });
  }
}
