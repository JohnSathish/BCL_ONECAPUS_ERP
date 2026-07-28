import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

/**
 * AI-ready event stream for future pipelines (tutor, quiz generator, prediction).
 * Consumers should poll pending events or subscribe to sync log completion.
 */
@Injectable()
export class MoodleEventsService {
  constructor(private readonly prisma: PrismaService) {}

  async emit(input: {
    tenantId: string;
    entityType: string;
    entityId?: string;
    action: string;
    metadata?: Record<string, unknown>;
    payload?: unknown;
  }) {
    const payloadHash = input.payload
      ? createHash('sha256').update(JSON.stringify(input.payload)).digest('hex')
      : null;
    return this.prisma.moodleSyncEvent.create({
      data: {
        tenantId: input.tenantId,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        action: input.action,
        payloadHash,
        status: 'PENDING',
        metadata:
          (input.metadata as Prisma.InputJsonValue | undefined) ?? undefined,
      },
    });
  }

  async listPending(tenantId: string, limit = 50) {
    return this.prisma.moodleSyncEvent.findMany({
      where: { tenantId, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  async markProcessed(id: string, status: 'DONE' | 'FAILED') {
    return this.prisma.moodleSyncEvent.update({
      where: { id },
      data: { status },
    });
  }
}
