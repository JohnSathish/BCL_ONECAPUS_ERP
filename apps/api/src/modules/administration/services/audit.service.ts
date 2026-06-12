import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import type { ListAuditLogsQueryDto } from '../dto/audit.dto';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, query: ListAuditLogsQueryDto) {
    const page = Math.max(1, parseInt(query.page ?? '1', 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(query.limit ?? '25', 10) || 25),
    );
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = { tenantId };

    if (query.userId) where.userId = query.userId;
    if (query.module) where.module = query.module;
    if (query.action)
      where.action = { contains: query.action, mode: 'insensitive' };
    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
    }

    const [total, logs] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, email: true, displayName: true } },
        },
      }),
    ]);

    return {
      items: logs.map((l) => ({
        id: l.id,
        userId: l.userId,
        user: l.user,
        module: l.module,
        action: l.action,
        entityType: l.entityType,
        entityId: l.entityId,
        metadata: l.metadata,
        createdAt: l.createdAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
