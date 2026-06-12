import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { QueueService } from '../../../shared/queue/queue.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import type {
  CommunicationCampaignDto,
  PreviewAudienceDto,
} from '../dto/communication.dto';
import { CommunicationAudienceService } from './communication-audience.service';
import { CommunicationTemplatesService } from './communication-templates.service';

@Injectable()
export class CommunicationCampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audience: CommunicationAudienceService,
    private readonly templates: CommunicationTemplatesService,
    private readonly queue: QueueService,
  ) {}

  list(tenantId: string, status?: string) {
    return this.prisma.communicationCampaign.findMany({
      where: {
        tenantId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        template: { select: { id: true, name: true, code: true } },
        _count: { select: { recipients: true, deliveryLogs: true } },
      },
      take: 100,
    });
  }

  async get(tenantId: string, id: string) {
    const row = await this.prisma.communicationCampaign.findFirst({
      where: { id, tenantId },
      include: {
        template: true,
        _count: { select: { recipients: true } },
      },
    });
    if (!row) throw new NotFoundException('Campaign not found');
    return row;
  }

  async create(user: JwtUser, dto: CommunicationCampaignDto) {
    let subject = dto.subject;
    let bodyHtml = dto.bodyHtml;
    let bodyText = dto.bodyText;

    if (dto.templateId) {
      const tpl = await this.templates.get(user.tid, dto.templateId);
      subject = dto.subject || tpl.subject || tpl.name;
      bodyHtml = dto.bodyHtml ?? tpl.bodyHtml ?? undefined;
      bodyText = dto.bodyText ?? tpl.bodyText ?? undefined;
    }

    return this.prisma.communicationCampaign.create({
      data: {
        tenantId: user.tid,
        templateId: dto.templateId,
        name: dto.name,
        subject,
        bodyHtml,
        bodyText,
        audienceType: dto.audienceType,
        audienceFilter: (dto.audienceFilter ?? {}) as Prisma.InputJsonValue,
        channels: (dto.channels ?? [
          'IN_APP',
          'EMAIL',
        ]) as Prisma.InputJsonValue,
        attachments: (dto.attachments ?? []) as Prisma.InputJsonValue,
        status: dto.scheduledAt ? 'SCHEDULED' : 'DRAFT',
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        createdById: user.sub,
      },
    });
  }

  previewAudience(user: JwtUser, dto: PreviewAudienceDto) {
    return this.audience.resolve(
      user.tid,
      dto.audienceType,
      dto.audienceFilter ?? {},
    );
  }

  async send(user: JwtUser, campaignId: string) {
    const campaign = await this.get(user.tid, campaignId);
    if (!['DRAFT', 'SCHEDULED'].includes(campaign.status)) {
      throw new BadRequestException(
        `Campaign cannot be sent from status ${campaign.status}`,
      );
    }

    const recipients = await this.audience.resolve(
      user.tid,
      campaign.audienceType,
      (campaign.audienceFilter ?? {}) as {
        departmentIds?: string[];
        programVersionIds?: string[];
        userIds?: string[];
        studentIds?: string[];
        staffProfileIds?: string[];
      },
    );
    if (!recipients.length) {
      throw new BadRequestException(
        'No recipients matched the selected audience',
      );
    }

    await this.prisma.communicationCampaign.update({
      where: { id: campaignId },
      data: { status: 'SENDING' },
    });

    await this.prisma.communicationRecipient.createMany({
      data: recipients.map((r) => ({
        tenantId: user.tid,
        campaignId,
        recipientType: r.recipientType,
        userId: r.userId,
        studentId: r.studentId,
        staffProfileId: r.staffProfileId,
        displayName: r.displayName,
        email: r.email,
        phone: r.phone,
      })),
    });

    await this.queue.enqueueNotification({
      jobType: 'campaign-deliver',
      tenantId: user.tid,
      campaignId,
    });

    return { campaignId, recipientCount: recipients.length, status: 'SENDING' };
  }

  recipients(tenantId: string, campaignId: string) {
    return this.prisma.communicationRecipient.findMany({
      where: { tenantId, campaignId },
      orderBy: { displayName: 'asc' },
      take: 500,
    });
  }

  deliveryLogs(
    tenantId: string,
    query: {
      campaignId?: string;
      channel?: string;
      status?: string;
      limit?: number;
    },
  ) {
    return this.prisma.communicationDeliveryLog.findMany({
      where: {
        tenantId,
        ...(query.campaignId ? { campaignId: query.campaignId } : {}),
        ...(query.channel ? { channel: query.channel } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(query.limit ?? 100, 500),
      include: {
        recipient: { select: { displayName: true, email: true } },
        campaign: { select: { name: true, subject: true } },
      },
    });
  }

  async dashboard(tenantId: string) {
    const [
      templates,
      campaigns,
      sent,
      pending,
      deliveryStats,
      recentCampaigns,
    ] = await Promise.all([
      this.prisma.communicationTemplate.count({
        where: { tenantId, deletedAt: null, isActive: true },
      }),
      this.prisma.communicationCampaign.count({ where: { tenantId } }),
      this.prisma.communicationCampaign.count({
        where: { tenantId, status: 'SENT' },
      }),
      this.prisma.communicationCampaign.count({
        where: { tenantId, status: { in: ['DRAFT', 'SCHEDULED', 'SENDING'] } },
      }),
      this.prisma.communicationDeliveryLog.groupBy({
        by: ['channel', 'status'],
        where: { tenantId },
        _count: true,
      }),
      this.prisma.communicationCampaign.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          name: true,
          status: true,
          sentAt: true,
          createdAt: true,
          audienceType: true,
        },
      }),
    ]);

    return {
      templates,
      campaigns,
      sent,
      pending,
      deliveryStats,
      recentCampaigns,
    };
  }
}
