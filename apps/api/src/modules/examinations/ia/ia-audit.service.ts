import { Injectable } from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class IaAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(
    user: JwtUser,
    entity: string,
    entityId: string | null,
    action: string,
    before?: unknown,
    after?: unknown,
    metadata?: Record<string, unknown>,
  ) {
    await (this.prisma as any).examAuditLog.create({
      data: {
        tenantId: user.tid,
        actorId: user.sub,
        entity,
        entityId,
        action,
        before: before ?? undefined,
        after: after ?? undefined,
        metadata: { module: 'ia', ...(metadata ?? {}) },
      },
    });
  }
}
