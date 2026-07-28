import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class MoodleNotificationService {
  private readonly logger = new Logger(MoodleNotificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Poll hook — stores notifications for unified ERP notification center. */
  async pollTenant(tenantId: string) {
    const cfg = await this.prisma.moodleSettings.findUnique({
      where: { tenantId },
    });
    if (!cfg?.enableNotificationSync) return { ingested: 0 };

    // Placeholder until Moodle message web service is configured on the instance.
    this.logger.debug(`Moodle notification poll tenant=${tenantId}`);
    return { ingested: 0 };
  }

  async ingest(input: {
    tenantId: string;
    erpUserId?: string;
    moodleUserId?: number;
    title: string;
    body?: string;
    category?: string;
    rawPayload?: Record<string, unknown>;
  }) {
    return this.prisma.moodleNotification.create({
      data: {
        tenantId: input.tenantId,
        erpUserId: input.erpUserId ?? null,
        moodleUserId: input.moodleUserId ?? null,
        title: input.title,
        body: input.body ?? null,
        category: input.category ?? 'GENERAL',
        rawPayload:
          (input.rawPayload as Prisma.InputJsonValue | undefined) ?? undefined,
      },
    });
  }

  async listForUser(tenantId: string, erpUserId: string, limit = 30) {
    return this.prisma.moodleNotification.findMany({
      where: { tenantId, erpUserId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
