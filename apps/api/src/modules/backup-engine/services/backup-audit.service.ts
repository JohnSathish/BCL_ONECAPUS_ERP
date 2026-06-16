import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

export type BackupAuditAction =
  | 'CREATE'
  | 'DOWNLOAD'
  | 'VERIFY'
  | 'RESTORE'
  | 'DELETE'
  | 'CONFIG_CHANGE';

@Injectable()
export class BackupAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: {
    action: BackupAuditAction;
    actorId?: string;
    ipAddress?: string;
    runId?: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.prisma.backupAuditLog.create({
      data: {
        action: input.action,
        actorId: input.actorId,
        ipAddress: input.ipAddress,
        runId: input.runId,
        metadata: (input.metadata ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
      },
    });
  }

  async list(query: { page?: number; limit?: number; action?: string }) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 30, 100);
    const where = query.action ? { action: query.action } : {};
    const [items, total] = await Promise.all([
      this.prisma.backupAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          run: { select: { id: true, type: true, status: true } },
        },
      }),
      this.prisma.backupAuditLog.count({ where }),
    ]);
    return { items, total, page, limit };
  }
}
