import { Injectable, Logger, Optional } from '@nestjs/common';
import { CommunicationTriggerService } from '../../communication/services/communication-trigger.service';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class SecurityNotifyService {
  private readonly logger = new Logger(SecurityNotifyService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly triggers?: CommunicationTriggerService,
  ) {}

  async notify(input: {
    tenantId: string;
    userId: string;
    templateCode: string;
    triggerKey: string;
    entityType: string;
    entityId: string;
    variables?: Record<string, string>;
    channels?: ('EMAIL' | 'IN_APP' | 'PUSH')[];
    enabled?: boolean;
  }) {
    if (input.enabled === false) return;
    if (!this.triggers) {
      this.logger.debug(`Skip ${input.templateCode} — triggers unavailable`);
      return;
    }

    const user = await this.prisma.user.findFirst({
      where: { id: input.userId, tenantId: input.tenantId, deletedAt: null },
      select: { email: true, displayName: true },
    });
    if (!user?.email) return;

    try {
      await this.triggers.trigger({
        tenantId: input.tenantId,
        templateCode: input.templateCode,
        triggerKey: input.triggerKey,
        entityType: input.entityType,
        entityId: input.entityId,
        recipient: {
          recipientType: 'USER',
          userId: input.userId,
          displayName: user.displayName ?? user.email,
          email: user.email,
        },
        variables: {
          user_name: user.displayName ?? user.email,
          institution_name: 'OneCampus',
          ...(input.variables ?? {}),
        },
        channels: input.channels ?? ['EMAIL', 'IN_APP', 'PUSH'],
        skipDedupe: true,
      });
    } catch (err) {
      this.logger.warn(
        `Failed ${input.templateCode}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
