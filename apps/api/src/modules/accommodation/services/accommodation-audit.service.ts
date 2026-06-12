import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class AccommodationAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(
    tenantId: string,
    entityType: string,
    entityId: string,
    action: string,
    userId: string | undefined,
    oldValue?: unknown,
    newValue?: unknown,
  ) {
    await this.prisma.quarterAuditLog.create({
      data: {
        tenantId,
        entityType,
        entityId,
        action,
        userId: userId ?? null,
        oldValue: oldValue != null ? (oldValue as object) : undefined,
        newValue: newValue != null ? (newValue as object) : undefined,
      },
    });
  }

  list(tenantId: string, entityType?: string, entityId?: string, limit = 100) {
    return this.prisma.quarterAuditLog.findMany({
      where: {
        tenantId,
        ...(entityType ? { entityType } : {}),
        ...(entityId ? { entityId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
