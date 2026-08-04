import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { QueueService } from '../../../shared/queue/queue.service';
import type { ResolvedRecipient } from './communication-audience.service';
import { CommunicationTemplateRendererService } from './communication-template-renderer.service';

export type TriggerInput = {
  tenantId: string;
  templateCode: string;
  triggerKey: string;
  entityType: string;
  entityId: string;
  recipient: ResolvedRecipient;
  variables: Record<string, string>;
  channels?: ('EMAIL' | 'IN_APP' | 'SMS' | 'WHATSAPP' | 'PUSH')[];
  skipDedupe?: boolean;
};

@Injectable()
export class CommunicationTriggerService {
  private readonly logger = new Logger(CommunicationTriggerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly renderer: CommunicationTemplateRendererService,
    private readonly queue: QueueService,
  ) {}

  async trigger(
    input: TriggerInput,
  ): Promise<{ campaignId?: string; skipped?: boolean }> {
    try {
      if (this.isAutomatedFeeEmailTrigger(input)) {
        const allowed = await this.isAutomatedFeeEmailsEnabled(input.tenantId);
        if (!allowed) {
          this.logger.debug(
            `Skipping automated fee email ${input.triggerKey} — disabled in fee settings`,
          );
          return { skipped: true };
        }
      }

      if (!input.skipDedupe) {
        const existing = await this.prisma.communicationTriggerLog.findUnique({
          where: {
            tenantId_triggerKey_entityType_entityId: {
              tenantId: input.tenantId,
              triggerKey: input.triggerKey,
              entityType: input.entityType,
              entityId: input.entityId,
            },
          },
        });
        if (existing) return { skipped: true };
      }

      const template = await this.prisma.communicationTemplate.findFirst({
        where: {
          tenantId: input.tenantId,
          code: input.templateCode,
          isActive: true,
          deletedAt: null,
        },
      });
      if (!template) {
        this.logger.debug(
          `Template ${input.templateCode} not found for tenant ${input.tenantId}`,
        );
        return { skipped: true };
      }

      const rendered = this.renderer.renderAll(
        {
          subject: template.subject,
          bodyHtml: template.bodyHtml,
          bodyText: template.bodyText,
        },
        input.variables,
      );

      const channels = input.channels ??
        (template.channels as string[] as (
          | 'EMAIL'
          | 'IN_APP'
          | 'SMS'
          | 'WHATSAPP'
          | 'PUSH'
        )[]) ?? ['EMAIL', 'IN_APP'];
      const campaignName = `${input.triggerKey}: ${rendered.subject || template.name}`;

      const campaign = await this.prisma.communicationCampaign.create({
        data: {
          tenantId: input.tenantId,
          templateId: template.id,
          name: campaignName.slice(0, 200),
          subject: rendered.subject || template.name,
          bodyHtml: rendered.bodyHtml || undefined,
          bodyText: rendered.bodyText || undefined,
          audienceType: 'INDIVIDUAL',
          audienceFilter: {
            userIds: input.recipient.userId ? [input.recipient.userId] : [],
          } as Prisma.InputJsonValue,
          channels: channels as Prisma.InputJsonValue,
          status: 'SENDING',
          metadata: {
            trigger: input.triggerKey,
            entityType: input.entityType,
            entityId: input.entityId,
            templateCode: input.templateCode,
            variables: input.variables,
          } as Prisma.InputJsonValue,
        },
      });

      await this.prisma.communicationRecipient.create({
        data: {
          tenantId: input.tenantId,
          campaignId: campaign.id,
          recipientType: input.recipient.recipientType,
          userId: input.recipient.userId,
          studentId: input.recipient.studentId,
          staffProfileId: input.recipient.staffProfileId,
          displayName: input.recipient.displayName,
          email: input.recipient.email,
          phone: input.recipient.phone,
        },
      });

      if (!input.skipDedupe) {
        await this.prisma.communicationTriggerLog.create({
          data: {
            tenantId: input.tenantId,
            triggerKey: input.triggerKey,
            entityType: input.entityType,
            entityId: input.entityId,
            campaignId: campaign.id,
          },
        });
      }

      await this.queue.enqueueNotification({
        jobType: 'campaign-deliver',
        tenantId: input.tenantId,
        campaignId: campaign.id,
      });

      return { campaignId: campaign.id };
    } catch (err) {
      this.logger.error(
        `Trigger ${input.triggerKey} failed`,
        err instanceof Error ? err.stack : err,
      );
      return { skipped: true };
    }
  }

  async triggerBulk(
    input: Omit<TriggerInput, 'recipient' | 'entityId' | 'variables'> & {
      recipients: Array<{
        recipient: ResolvedRecipient;
        entityId: string;
        variables: Record<string, string>;
      }>;
    },
  ) {
    const results = [];
    for (const row of input.recipients) {
      results.push(
        await this.trigger({
          tenantId: input.tenantId,
          templateCode: input.templateCode,
          triggerKey: input.triggerKey,
          entityType: input.entityType,
          entityId: row.entityId,
          recipient: row.recipient,
          variables: row.variables,
          channels: input.channels,
          skipDedupe: input.skipDedupe,
        }),
      );
    }
    return results;
  }

  async getInstitutionName(tenantId: string): Promise<string> {
    const branding = await this.prisma.tenantBranding.findUnique({
      where: { tenantId },
      select: { displayName: true },
    });
    return branding?.displayName ?? 'Institution';
  }

  /** Manual bulk reminders use trigger keys ending in `_manual` and stay allowed. */
  private isAutomatedFeeEmailTrigger(input: TriggerInput): boolean {
    const code = input.templateCode.toUpperCase();
    if (code !== 'FEE_REMINDER' && code !== 'PARENT_FEE_REMINDER') return false;
    if (input.triggerKey.endsWith('_manual')) return false;
    return true;
  }

  private async isAutomatedFeeEmailsEnabled(
    tenantId: string,
  ): Promise<boolean> {
    try {
      const settings = await this.prisma.feeFinanceSettings.findUnique({
        where: { tenantId },
        select: { automatedFeeEmailsEnabled: true },
      });
      return settings?.automatedFeeEmailsEnabled === true;
    } catch {
      // Column missing before migrate — treat as disabled.
      return false;
    }
  }
}
