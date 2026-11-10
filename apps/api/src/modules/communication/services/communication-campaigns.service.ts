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
  CampaignDeskQueryDto,
  CampaignRecipientQueryDto,
  CommunicationCampaignDto,
  PreviewAudienceDto,
} from '../dto/communication.dto';
import {
  buildCampaignRecipientWorkbook,
  buildCampaignReportPdf,
  type CampaignReportInput,
  type CampaignReportRecipient,
} from './communication-campaign-documents';
import { CommunicationAudienceService } from './communication-audience.service';
import { CommunicationTemplatesService } from './communication-templates.service';

const BATCH_SIZE = 100;

@Injectable()
export class CommunicationCampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audience: CommunicationAudienceService,
    private readonly templates: CommunicationTemplatesService,
    private readonly queue: QueueService,
  ) {}

  async list(tenantId: string, status?: string) {
    const rows = await this.prisma.communicationCampaign.findMany({
      where: {
        tenantId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        template: { select: { id: true, name: true, code: true } },
        _count: {
          select: { recipients: true, deliveryLogs: true, notifications: true },
        },
      },
      take: 100,
    });

    // Recipient rows are created only when a campaign is sent. Drafts otherwise
    // display as 0 even when the audience preview already found thousands.
    const missingEstimate = rows
      .filter((row) => {
        if ((row._count?.recipients ?? 0) > 0) return false;
        if (!['DRAFT', 'SCHEDULED', 'SENDING', 'FAILED'].includes(row.status)) {
          return false;
        }
        const meta = (row.metadata ?? {}) as Record<string, unknown>;
        return typeof meta.estimatedRecipients !== 'number';
      })
      .slice(0, 8);

    for (const row of missingEstimate) {
      try {
        const count = await this.audience.count(
          tenantId,
          row.audienceType,
          (row.audienceFilter ?? {}) as {
            departmentIds?: string[];
            programVersionIds?: string[];
            userIds?: string[];
            studentIds?: string[];
            staffProfileIds?: string[];
          },
        );
        const metadata = {
          ...((row.metadata ?? {}) as Record<string, unknown>),
          estimatedRecipients: count.total,
          estimatedPush: count.withPush,
        };
        await this.prisma.communicationCampaign.update({
          where: { id: row.id },
          data: { metadata: metadata as Prisma.InputJsonValue },
        });
        row.metadata = metadata as Prisma.JsonValue;
      } catch {
        // Keep the row; the list must still load if one audience resolve fails.
      }
    }

    return rows;
  }

  async desk(tenantId: string, query: CampaignDeskQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const kind = query.kind ?? 'all';
    const filters = [Prisma.sql`c.tenant_id = CAST(${tenantId} AS uuid)`];
    if (query.status) filters.push(Prisma.sql`c.status = ${query.status}`);
    if (query.audience)
      filters.push(Prisma.sql`c.audience_type = ${query.audience}`);
    if (query.from)
      filters.push(
        Prisma.sql`COALESCE(c.sent_at, c.created_at) >= ${new Date(`${query.from}T00:00:00`)}`,
      );
    if (query.to)
      filters.push(
        Prisma.sql`COALESCE(c.sent_at, c.created_at) <= ${new Date(`${query.to}T23:59:59`)}`,
      );
    if (query.search?.trim()) {
      const pattern = `%${query.search.trim()}%`;
      filters.push(
        Prisma.sql`(c.name ILIKE ${pattern} OR c.id::text ILIKE ${pattern} OR COALESCE(t.code, '') ILIKE ${pattern})`,
      );
    }
    if (kind === 'automated')
      filters.push(Prisma.sql`COALESCE(c.metadata->>'trigger', '') <> ''`);
    if (kind === 'manual')
      filters.push(Prisma.sql`COALESCE(c.metadata->>'trigger', '') = ''`);
    if (query.noticeType === 'security') {
      filters.push(
        Prisma.sql`(COALESCE(t.code, '') ILIKE '%SECURITY%' OR c.name ILIKE '%PASSWORD%' OR c.name ILIKE '%DEVICE%' OR c.name ILIKE '%SECURITY%')`,
      );
    }
    if (query.noticeType === 'academic') {
      filters.push(
        Prisma.sql`(c.name ILIKE '%EXAM%' OR c.name ILIKE '%FEE%' OR c.name ILIKE '%ATTEND%' OR c.name ILIKE '%RESULT%' OR COALESCE(t.code, '') ILIKE '%EXAM%' OR COALESCE(t.code, '') ILIKE '%FEE%')`,
      );
    }
    if (query.noticeType === 'events') {
      filters.push(
        Prisma.sql`(c.name ILIKE '%EVENT%' OR COALESCE(t.code, '') ILIKE '%EVENT%')`,
      );
    }
    if (query.noticeType === 'notice') {
      filters.push(Prisma.sql`NOT (
        COALESCE(t.code, '') ILIKE '%SECURITY%' OR c.name ILIKE '%PASSWORD%' OR c.name ILIKE '%DEVICE%' OR c.name ILIKE '%SECURITY%'
        OR c.name ILIKE '%EXAM%' OR c.name ILIKE '%FEE%' OR c.name ILIKE '%ATTEND%' OR c.name ILIKE '%RESULT%'
        OR c.name ILIKE '%EVENT%' OR COALESCE(t.code, '') ILIKE '%EVENT%' OR COALESCE(t.code, '') ILIKE '%EXAM%' OR COALESCE(t.code, '') ILIKE '%FEE%'
      )`);
    }
    const where = Prisma.join(filters, ' AND ');
    const [idRows, countRows, summary] = await Promise.all([
      this.prisma.$queryRaw<{ id: string }[]>`
        SELECT c.id
        FROM platform.communication_campaigns c
        LEFT JOIN platform.communication_templates t ON t.id = c.template_id
        WHERE ${where}
        ORDER BY COALESCE(c.sent_at, c.created_at) DESC
        LIMIT ${limit} OFFSET ${(page - 1) * limit}
      `,
      this.prisma.$queryRaw<{ total: number }[]>`
        SELECT COUNT(*)::int AS total
        FROM platform.communication_campaigns c
        LEFT JOIN platform.communication_templates t ON t.id = c.template_id
        WHERE ${where}
      `,
      this.campaignSummary(tenantId),
    ]);
    const ids = idRows.map((row) => row.id);
    const found = ids.length
      ? await this.prisma.communicationCampaign.findMany({
          where: { id: { in: ids } },
          include: {
            template: { select: { id: true, name: true, code: true } },
            _count: {
              select: {
                recipients: true,
                deliveryLogs: true,
                notifications: true,
              },
            },
          },
        })
      : [];
    const order = new Map(ids.map((id, index) => [id, index]));
    found.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    const delivery = await this.deliveryByCampaign(tenantId, ids);
    return {
      page,
      limit,
      total: Number(countRows[0]?.total ?? 0),
      summary,
      items: found.map((row) => ({
        ...row,
        delivery: delivery.get(row.id) ?? {
          confirmed: 0,
          accepted: 0,
          failed: 0,
        },
      })),
    };
  }

  private async campaignSummary(tenantId: string) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const [
      campaigns,
      campaignsThen,
      recipients,
      recipientsThen,
      delivered,
      pending,
      failed,
      split,
    ] = await Promise.all([
      this.prisma.communicationCampaign.count({ where: { tenantId } }),
      this.prisma.communicationCampaign.count({
        where: { tenantId, createdAt: { lt: cutoff } },
      }),
      this.prisma.communicationRecipient.count({ where: { tenantId } }),
      this.prisma.communicationRecipient.count({
        where: { tenantId, createdAt: { lt: cutoff } },
      }),
      this.prisma.communicationDeliveryLog.count({
        where: { tenantId, status: { in: ['SENT', 'DELIVERED'] } },
      }),
      this.prisma.communicationDeliveryLog.count({
        where: { tenantId, status: 'PENDING' },
      }),
      this.prisma.communicationDeliveryLog.count({
        where: { tenantId, status: 'FAILED' },
      }),
      this.prisma.$queryRaw<{ automated: number; manual: number }[]>`
        SELECT
          COUNT(*) FILTER (WHERE COALESCE(metadata->>'trigger', '') <> '')::int AS automated,
          COUNT(*) FILTER (WHERE COALESCE(metadata->>'trigger', '') = '')::int AS manual
        FROM platform.communication_campaigns
        WHERE tenant_id = CAST(${tenantId} AS uuid)
      `,
    ]);
    const outcomes = delivered + pending + failed;
    const share = (value: number) =>
      outcomes ? Math.round((value / outcomes) * 1000) / 10 : null;
    return {
      campaigns,
      campaignsGrowth: growth(campaigns, campaignsThen),
      recipients,
      recipientsGrowth: growth(recipients, recipientsThen),
      delivered,
      pending,
      failed,
      deliveredShare: share(delivered),
      pendingShare: share(pending),
      failedShare: share(failed),
      automated: Number(split[0]?.automated ?? 0),
      manual: Number(split[0]?.manual ?? 0),
    };
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

    const metadata = (dto.metadata ?? {}) as Record<string, unknown>;

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
        metadata: metadata as Prisma.InputJsonValue,
        status: dto.scheduledAt ? 'SCHEDULED' : 'DRAFT',
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        createdById: user.sub,
        requiresApproval: false,
        approvalStatus: 'NONE',
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

  previewAudienceCount(user: JwtUser, dto: PreviewAudienceDto) {
    return this.audience.count(
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

    await this.prisma.communicationCampaign.update({
      where: { id: campaignId },
      data: {
        status: 'SENDING',
        // Large broadcasts no longer require an approval gate before delivery.
        requiresApproval: false,
        approvalStatus: 'NONE',
      },
    });

    // Resolve audience + deliver in the worker so the HTTP request stays under the web timeout.
    try {
      await this.queue.enqueueNotification({
        jobType: 'campaign-prepare-and-deliver',
        tenantId: user.tid,
        campaignId,
      });
    } catch (error) {
      await this.prisma.communicationCampaign.update({
        where: { id: campaignId },
        data: { status: campaign.status },
      });
      throw error;
    }

    return { campaignId, recipientCount: 0, status: 'SENDING' };
  }

  /** Called by the notifications worker after send() enqueues prepare. */
  async prepareAndDeliver(tenantId: string, campaignId: string) {
    const campaign = await this.get(tenantId, campaignId);
    if (campaign.status !== 'SENDING') return { skipped: true };

    const existing = await this.prisma.communicationRecipient.count({
      where: { tenantId, campaignId },
    });
    if (existing === 0) {
      const recipients = await this.audience.resolve(
        tenantId,
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
        await this.prisma.communicationCampaign.update({
          where: { id: campaignId },
          data: {
            status: 'FAILED',
            metadata: {
              ...(campaign.metadata as object),
              failureReason: 'No recipients matched the selected audience',
            },
          },
        });
        return { recipientCount: 0, status: 'FAILED' };
      }

      for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
        const chunk = recipients.slice(i, i + BATCH_SIZE);
        await this.prisma.communicationRecipient.createMany({
          data: chunk.map((r) => ({
            tenantId,
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
      }
    }

    // If a prior deliver pass already logged successes, skip re-enqueue
    // (BullMQ stall/retries can re-run prepare while status is still SENDING).
    const alreadyDelivered = await this.prisma.communicationDeliveryLog.count({
      where: {
        tenantId,
        campaignId,
        status: { in: ['SENT', 'DELIVERED'] },
      },
    });
    if (alreadyDelivered > 0) {
      const recipientCount = await this.prisma.communicationRecipient.count({
        where: { tenantId, campaignId },
      });
      return { recipientCount, status: 'SENDING', skippedDeliverEnqueue: true };
    }

    await this.queue.enqueueNotification({
      jobType: 'campaign-deliver',
      tenantId,
      campaignId,
    });

    const recipientCount = await this.prisma.communicationRecipient.count({
      where: { tenantId, campaignId },
    });
    return { recipientCount, status: 'SENDING' };
  }

  async cancel(user: JwtUser, campaignId: string) {
    const campaign = await this.get(user.tid, campaignId);
    if (!['DRAFT', 'SCHEDULED', 'SENDING'].includes(campaign.status)) {
      throw new BadRequestException('Campaign cannot be cancelled');
    }
    return this.prisma.communicationCampaign.update({
      where: { id: campaignId },
      data: {
        status: 'CANCELLED',
        metadata: {
          ...(campaign.metadata as object),
          cancelledAt: new Date().toISOString(),
        },
      },
    });
  }

  /**
   * Stop a sent or in-progress campaign and delete its in-app copies.
   * A banner already drawn on a phone lock screen cannot be recalled.
   */
  async revoke(user: JwtUser, campaignId: string) {
    const campaign = await this.get(user.tid, campaignId);
    if (!['SENT', 'SENDING', 'FAILED'].includes(campaign.status)) {
      throw new BadRequestException(
        'Only a sent or in-progress campaign can be revoked',
      );
    }

    await this.prisma.communicationCampaign.update({
      where: { id: campaignId },
      data: { status: 'REVOKED' },
    });

    const removed = await this.prisma.userNotification.deleteMany({
      where: { tenantId: user.tid, campaignId },
    });

    await this.prisma.communicationCampaign.update({
      where: { id: campaignId },
      data: {
        metadata: {
          ...(campaign.metadata as object),
          revokedAt: new Date().toISOString(),
          revokedById: user.sub,
          revokedNotificationCount: removed.count,
        },
      },
    });

    return {
      campaignId,
      status: 'REVOKED',
      removedNotifications: removed.count,
    };
  }

  async retryDelivery(user: JwtUser, logId: string) {
    const log = await this.prisma.communicationDeliveryLog.findFirst({
      where: { id: logId, tenantId: user.tid, status: 'FAILED' },
    });
    if (!log?.campaignId)
      throw new NotFoundException('Failed delivery log not found');

    const campaign = await this.get(user.tid, log.campaignId);
    if (campaign.status === 'REVOKED' || campaign.status === 'CANCELLED') {
      throw new BadRequestException('This campaign was revoked');
    }

    await this.queue.enqueueNotification({
      jobType: 'campaign-deliver-retry',
      tenantId: user.tid,
      campaignId: log.campaignId,
      recipientId: log.recipientId,
      channel: log.channel,
    });
    return { logId, status: 'QUEUED' };
  }

  async sendScheduled(
    tenantId: string,
    campaignId: string,
    systemUserId?: string,
  ) {
    const campaign = await this.get(tenantId, campaignId);
    if (campaign.status !== 'SCHEDULED') return null;

    const user = {
      tid: tenantId,
      sub: systemUserId ?? campaign.createdById ?? tenantId,
    } as JwtUser;
    return this.send(user, campaignId);
  }

  async detail(tenantId: string, id: string) {
    const row = await this.prisma.communicationCampaign.findFirst({
      where: { id, tenantId },
      include: {
        template: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, displayName: true, email: true } },
        _count: { select: { recipients: true, notifications: true } },
      },
    });
    if (!row) throw new NotFoundException('Campaign not found');
    const delivery = await this.deliverySummary(tenantId, id);
    return { ...row, delivery };
  }

  async recipientDirectory(
    tenantId: string,
    campaignId: string,
    query: CampaignRecipientQueryDto,
  ) {
    await this.get(tenantId, campaignId);
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 25, 100);
    const [items, total, departments] = await Promise.all([
      this.recipientRows(tenantId, campaignId, query, page, limit),
      this.recipientCount(tenantId, campaignId, query),
      this.recipientDepartments(tenantId, campaignId),
    ]);
    return { page, limit, total, departments, items };
  }

  async recipientDetail(
    tenantId: string,
    campaignId: string,
    recipientId: string,
  ) {
    const campaign = await this.get(tenantId, campaignId);
    const rows = await this.recipientRows(
      tenantId,
      campaignId,
      {},
      1,
      1,
      recipientId,
    );
    const row = rows[0];
    if (!row) throw new NotFoundException('Recipient not found');
    return {
      ...row,
      campaignSubject: campaign.subject,
      campaignBodyText: campaign.bodyText,
      campaignBodyHtml: campaign.bodyHtml,
      inboxRemoved: campaign.status === 'REVOKED',
    };
  }

  async duplicate(user: JwtUser, campaignId: string) {
    const campaign = await this.get(user.tid, campaignId);
    const copy = await this.prisma.communicationCampaign.create({
      data: {
        tenantId: user.tid,
        templateId: campaign.templateId,
        name: `Copy of ${campaign.name}`.slice(0, 200),
        subject: campaign.subject,
        bodyHtml: campaign.bodyHtml,
        bodyText: campaign.bodyText,
        audienceType: campaign.audienceType,
        audienceFilter: (campaign.audienceFilter ??
          {}) as Prisma.InputJsonValue,
        channels: (campaign.channels ?? []) as Prisma.InputJsonValue,
        attachments: (campaign.attachments ?? []) as Prisma.InputJsonValue,
        status: 'DRAFT',
        createdById: user.sub,
        requiresApproval: false,
        approvalStatus: 'NONE',
        metadata: {
          duplicatedFrom: campaign.id,
          duplicatedAt: new Date().toISOString(),
          duplicatedById: user.sub,
        },
      },
    });
    return copy;
  }

  async queueResendFailed(user: JwtUser, campaignId: string) {
    const campaign = await this.get(user.tid, campaignId);
    if (
      ['REVOKED', 'CANCELLED', 'DRAFT', 'SCHEDULED'].includes(campaign.status)
    ) {
      throw new BadRequestException(
        'Only a sent campaign with failed deliveries can be resent',
      );
    }
    const metadata = (campaign.metadata ?? {}) as Record<string, unknown>;
    const until = metadata.resendFailedRunningUntil;
    if (typeof until === 'string' && new Date(until).getTime() > Date.now()) {
      throw new BadRequestException(
        'A resend of failed recipients is already running for this campaign',
      );
    }
    const failed = await this.failedRecipientCount(user.tid, campaignId);
    if (!failed) {
      throw new BadRequestException('There are no failed recipients to resend');
    }
    const history = Array.isArray(metadata.resendHistory)
      ? metadata.resendHistory
      : [];
    const runningUntil = new Date(Date.now() + 20 * 60 * 1000).toISOString();
    await this.prisma.communicationCampaign.update({
      where: { id: campaignId },
      data: {
        metadata: {
          ...metadata,
          resendFailedRunningUntil: runningUntil,
          resendHistory: [
            ...history.slice(-19),
            {
              at: new Date().toISOString(),
              by: user.sub,
              failedRecipients: failed,
            },
          ],
        } as Prisma.InputJsonValue,
      },
    });
    try {
      await this.queue.enqueueNotification({
        jobType: 'campaign-resend-failed',
        tenantId: user.tid,
        campaignId,
      });
    } catch (error) {
      await this.releaseResendLock(user.tid, campaignId);
      throw error;
    }
    return { campaignId, queued: failed, status: 'QUEUED' };
  }

  async exportRecipients(
    tenantId: string,
    campaignId: string,
    query: CampaignRecipientQueryDto,
  ) {
    const report = await this.reportInput(tenantId, campaignId, query, 20000);
    return buildCampaignRecipientWorkbook(report);
  }

  async exportReport(
    tenantId: string,
    campaignId: string,
    query: CampaignRecipientQueryDto,
  ) {
    const report = await this.reportInput(tenantId, campaignId, query, 800);
    return buildCampaignReportPdf(report);
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
    // Legacy shape kept for backward compatibility; extended fields via CommunicationDashboardService
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

  private async deliveryByCampaign(tenantId: string, ids: string[]) {
    const map = new Map<
      string,
      { confirmed: number; accepted: number; failed: number }
    >();
    if (!ids.length) return map;
    const idList = Prisma.join(
      ids.map((id) => Prisma.sql`CAST(${id} AS uuid)`),
    );
    const rows = await this.prisma.$queryRaw<
      {
        campaign_id: string;
        confirmed: number;
        accepted: number;
        failed: number;
      }[]
    >`
      SELECT campaign_id,
        COUNT(*) FILTER (WHERE outcome = 'DELIVERED')::int AS confirmed,
        COUNT(*) FILTER (WHERE outcome = 'ACCEPTED')::int AS accepted,
        COUNT(*) FILTER (WHERE outcome = 'FAILED')::int AS failed
      FROM (
        SELECT campaign_id, recipient_id,
          CASE
            WHEN BOOL_OR(status = 'DELIVERED') THEN 'DELIVERED'
            WHEN BOOL_OR(status = 'SENT') THEN 'ACCEPTED'
            WHEN BOOL_OR(status = 'FAILED') THEN 'FAILED'
            ELSE 'PENDING'
          END AS outcome
        FROM platform.communication_delivery_logs
        WHERE tenant_id = CAST(${tenantId} AS uuid)
          AND campaign_id IN (${idList})
        GROUP BY campaign_id, recipient_id
      ) outcomes
      GROUP BY campaign_id
    `;
    for (const row of rows) {
      map.set(row.campaign_id, {
        confirmed: Number(row.confirmed ?? 0),
        accepted: Number(row.accepted ?? 0),
        failed: Number(row.failed ?? 0),
      });
    }
    return map;
  }

  private async deliverySummary(tenantId: string, campaignId: string) {
    const [counts, openedRows] = await Promise.all([
      this.prisma.$queryRaw<
        {
          recipients: number;
          confirmed: number;
          accepted: number;
          failed: number;
          pending: number;
          skipped: number;
        }[]
      >`
        WITH outcomes AS (
          SELECT recipient_id,
            CASE
              WHEN BOOL_OR(status = 'DELIVERED') THEN 'DELIVERED'
              WHEN BOOL_OR(status = 'SENT') THEN 'ACCEPTED'
              WHEN BOOL_OR(status = 'FAILED') THEN 'FAILED'
              WHEN BOOL_OR(status = 'SKIPPED') THEN 'SKIPPED'
              ELSE 'PENDING'
            END AS outcome
          FROM platform.communication_delivery_logs
          WHERE tenant_id = CAST(${tenantId} AS uuid)
            AND campaign_id = CAST(${campaignId} AS uuid)
          GROUP BY recipient_id
        )
        SELECT
          COUNT(r.id)::int AS recipients,
          COUNT(*) FILTER (WHERE o.outcome = 'DELIVERED')::int AS confirmed,
          COUNT(*) FILTER (WHERE o.outcome = 'ACCEPTED')::int AS accepted,
          COUNT(*) FILTER (WHERE o.outcome = 'FAILED')::int AS failed,
          COUNT(*) FILTER (WHERE COALESCE(o.outcome, 'PENDING') = 'PENDING')::int AS pending,
          COUNT(*) FILTER (WHERE o.outcome = 'SKIPPED')::int AS skipped
        FROM platform.communication_recipients r
        LEFT JOIN outcomes o ON o.recipient_id = r.id
        WHERE r.tenant_id = CAST(${tenantId} AS uuid)
          AND r.campaign_id = CAST(${campaignId} AS uuid)
      `,
      this.prisma.$queryRaw<{ opened: number }[]>`
        SELECT COUNT(*)::int AS opened FROM (
          SELECT user_id AS person
          FROM platform.notifications
          WHERE tenant_id = CAST(${tenantId} AS uuid)
            AND campaign_id = CAST(${campaignId} AS uuid)
            AND read_at IS NOT NULL
            AND user_id IS NOT NULL
          UNION
          SELECT recipient_id
          FROM platform.communication_delivery_logs
          WHERE tenant_id = CAST(${tenantId} AS uuid)
            AND campaign_id = CAST(${campaignId} AS uuid)
            AND opened_at IS NOT NULL
            AND recipient_id IS NOT NULL
        ) people
      `,
    ]);
    const row = counts[0];
    return {
      recipients: Number(row?.recipients ?? 0),
      confirmed: Number(row?.confirmed ?? 0),
      accepted: Number(row?.accepted ?? 0),
      failed: Number(row?.failed ?? 0),
      pending: Number(row?.pending ?? 0),
      skipped: Number(row?.skipped ?? 0),
      opened: Number(openedRows[0]?.opened ?? 0),
    };
  }

  private async failedRecipientCount(tenantId: string, campaignId: string) {
    const rows = await this.prisma.$queryRaw<{ total: number }[]>`
      SELECT COUNT(*)::int AS total FROM (
        SELECT DISTINCT l.recipient_id, l.channel
        FROM platform.communication_delivery_logs l
        WHERE l.tenant_id = CAST(${tenantId} AS uuid)
          AND l.campaign_id = CAST(${campaignId} AS uuid)
          AND l.status = 'FAILED'
          AND NOT EXISTS (
            SELECT 1 FROM platform.communication_delivery_logs ok
            WHERE ok.recipient_id = l.recipient_id
              AND ok.campaign_id = l.campaign_id
              AND ok.channel = l.channel
              AND ok.status IN ('SENT', 'DELIVERED')
          )
      ) failed_pairs
    `;
    return Number(rows[0]?.total ?? 0);
  }

  async releaseResendLock(tenantId: string, campaignId: string) {
    const campaign = await this.prisma.communicationCampaign.findFirst({
      where: { id: campaignId, tenantId },
      select: { metadata: true },
    });
    if (!campaign) return;
    const metadata = {
      ...((campaign.metadata ?? {}) as Record<string, unknown>),
    };
    delete metadata.resendFailedRunningUntil;
    await this.prisma.communicationCampaign.update({
      where: { id: campaignId },
      data: { metadata: metadata as Prisma.InputJsonValue },
    });
  }

  private recipientFrom(tenantId: string, campaignId: string) {
    return Prisma.sql`
      FROM platform.communication_recipients r
      LEFT JOIN (
        SELECT recipient_id,
          CASE
            WHEN BOOL_OR(status = 'DELIVERED') THEN 'DELIVERED'
            WHEN BOOL_OR(status = 'SENT') THEN 'ACCEPTED'
            WHEN BOOL_OR(status = 'FAILED') THEN 'FAILED'
            WHEN BOOL_OR(status = 'SKIPPED') THEN 'SKIPPED'
            ELSE 'PENDING'
          END AS outcome,
          MAX(delivered_at) AS delivered_at,
          MAX(sent_at) AS sent_at,
          MAX(opened_at) AS opened_at,
          (ARRAY_AGG(error_message ORDER BY created_at DESC)
            FILTER (WHERE status = 'FAILED' AND COALESCE(error_message, '') <> ''))[1] AS failure_reason,
          (ARRAY_AGG(channel ORDER BY created_at DESC))[1] AS channel
        FROM platform.communication_delivery_logs
        WHERE tenant_id = CAST(${tenantId} AS uuid)
          AND campaign_id = CAST(${campaignId} AS uuid)
        GROUP BY recipient_id
      ) o ON o.recipient_id = r.id
      LEFT JOIN academic.students s ON s.id = r.student_id
      LEFT JOIN academic.students su
        ON r.student_id IS NULL AND su.user_id = r.user_id AND su.deleted_at IS NULL
      LEFT JOIN academic.student_profiles sprof
        ON sprof.student_id = COALESCE(s.id, su.id)
      LEFT JOIN academic.staff_profiles sp ON sp.id = r.staff_profile_id
      LEFT JOIN academic.staff_profiles spu
        ON r.staff_profile_id IS NULL AND spu.portal_user_id = r.user_id
      LEFT JOIN core.departments sd
        ON sd.id = COALESCE(s.department_id, su.department_id)
      LEFT JOIN core.departments spd
        ON spd.id = COALESCE(sp.department_id, spu.department_id)
    `;
  }

  private recipientWhere(
    tenantId: string,
    campaignId: string,
    query: CampaignRecipientQueryDto,
    recipientId?: string,
  ) {
    const filters = [
      Prisma.sql`r.tenant_id = CAST(${tenantId} AS uuid)`,
      Prisma.sql`r.campaign_id = CAST(${campaignId} AS uuid)`,
    ];
    if (recipientId) {
      filters.push(Prisma.sql`r.id = CAST(${recipientId} AS uuid)`);
      return Prisma.join(filters, ' AND ');
    }
    const search = query.search?.trim().replace(/[%_]/g, '').slice(0, 120);
    if (search) {
      const pattern = `%${search}%`;
      filters.push(Prisma.sql`(
        COALESCE(r.display_name, '') ILIKE ${pattern}
        OR COALESCE(r.email, '') ILIKE ${pattern}
        OR COALESCE(s.roll_number, su.roll_number, '') ILIKE ${pattern}
        OR COALESCE(sp.employee_code, spu.employee_code, '') ILIKE ${pattern}
        OR COALESCE(sd.department_name, spd.department_name, '') ILIKE ${pattern}
      )`);
    }
    if (query.status === 'delivered')
      filters.push(Prisma.sql`o.outcome = 'DELIVERED'`);
    if (query.status === 'accepted')
      filters.push(Prisma.sql`o.outcome = 'ACCEPTED'`);
    if (query.status === 'failed')
      filters.push(Prisma.sql`o.outcome = 'FAILED'`);
    if (query.status === 'skipped')
      filters.push(Prisma.sql`o.outcome = 'SKIPPED'`);
    if (query.status === 'pending') {
      filters.push(Prisma.sql`COALESCE(o.outcome, 'PENDING') = 'PENDING'`);
    }
    if (query.role === 'students')
      filters.push(Prisma.sql`r.recipient_type = 'STUDENT'`);
    if (query.role === 'staff') {
      filters.push(
        Prisma.sql`r.recipient_type IN ('FACULTY', 'STAFF', 'TEACHING_STAFF', 'NON_TEACHING_STAFF')`,
      );
    }
    if (query.department?.trim()) {
      filters.push(
        Prisma.sql`COALESCE(sd.department_name, spd.department_name, '') = ${query.department.trim()}`,
      );
    }
    return Prisma.join(filters, ' AND ');
  }

  private recipientOrder(sort?: CampaignRecipientQueryDto['sort']) {
    if (sort === 'department') {
      return Prisma.sql`COALESCE(sd.department_name, spd.department_name, '') ASC, r.display_name ASC`;
    }
    if (sort === 'status') {
      return Prisma.sql`COALESCE(o.outcome, 'PENDING') ASC, r.display_name ASC`;
    }
    if (sort === 'delivered') {
      return Prisma.sql`o.delivered_at DESC NULLS LAST, o.sent_at DESC NULLS LAST, r.display_name ASC`;
    }
    return Prisma.sql`r.display_name ASC NULLS LAST, r.id ASC`;
  }

  private async recipientRows(
    tenantId: string,
    campaignId: string,
    query: CampaignRecipientQueryDto,
    page: number,
    limit: number,
    recipientId?: string,
  ) {
    const where = this.recipientWhere(tenantId, campaignId, query, recipientId);
    const order = this.recipientOrder(query.sort);
    const rows = await this.prisma.$queryRaw<RawCampaignRecipient[]>`
      SELECT
        r.id,
        r.display_name,
        r.email,
        r.phone,
        r.recipient_type,
        COALESCE(s.roll_number, su.roll_number) AS roll_number,
        COALESCE(sp.employee_code, spu.employee_code) AS staff_code,
        COALESCE(sd.department_name, spd.department_name) AS department,
        COALESCE(o.outcome, 'PENDING') AS outcome,
        COALESCE(o.sent_at, r.sent_at) AS sent_at,
        o.delivered_at,
        o.opened_at,
        note.read_at,
        o.failure_reason,
        o.channel,
        COALESCE(sprof.photo_path, sp.photo_url, spu.photo_url) AS photo_path,
        note.title AS rendered_title,
        note.body AS rendered_body
      ${this.recipientFrom(tenantId, campaignId)}
      LEFT JOIN LATERAL (
        SELECT title, body, read_at
        FROM platform.notifications n
        WHERE ${recipientId ? Prisma.sql`TRUE` : Prisma.sql`FALSE`}
          AND n.campaign_id = r.campaign_id
          AND n.user_id = r.user_id
        ORDER BY n.created_at DESC
        LIMIT 1
      ) note ON true
      WHERE ${where}
      ORDER BY ${order}
      LIMIT ${limit} OFFSET ${(page - 1) * limit}
    `;
    return rows.map(mapRecipient);
  }

  private async recipientCount(
    tenantId: string,
    campaignId: string,
    query: CampaignRecipientQueryDto,
  ) {
    const where = this.recipientWhere(tenantId, campaignId, query);
    const rows = await this.prisma.$queryRaw<{ total: number }[]>`
      SELECT COUNT(*)::int AS total
      ${this.recipientFrom(tenantId, campaignId)}
      WHERE ${where}
    `;
    return Number(rows[0]?.total ?? 0);
  }

  private async recipientDepartments(tenantId: string, campaignId: string) {
    const rows = await this.prisma.$queryRaw<{ name: string }[]>`
      SELECT DISTINCT COALESCE(sd.department_name, spd.department_name) AS name
      ${this.recipientFrom(tenantId, campaignId)}
      WHERE r.tenant_id = CAST(${tenantId} AS uuid)
        AND r.campaign_id = CAST(${campaignId} AS uuid)
        AND COALESCE(sd.department_name, spd.department_name, '') <> ''
      ORDER BY 1
      LIMIT 200
    `;
    return rows.map((row) => row.name).filter(Boolean);
  }

  private async reportInput(
    tenantId: string,
    campaignId: string,
    query: CampaignRecipientQueryDto,
    cap: number,
  ): Promise<CampaignReportInput> {
    const campaign = await this.detail(tenantId, campaignId);
    const total = await this.recipientCount(tenantId, campaignId, query);
    const rows = await this.recipientRows(
      tenantId,
      campaignId,
      { ...query, sort: query.sort ?? 'name' },
      1,
      Math.min(total || cap, cap),
    );
    const metadata = (campaign.metadata ?? {}) as Record<string, unknown>;
    const channels = Array.isArray(campaign.channels)
      ? campaign.channels.map(String).join(', ')
      : '';
    const createdBy = campaign.createdBy;
    return {
      name: campaign.name,
      id: campaign.id,
      status: campaign.status,
      typeLabel: campaignTypeLabel(
        campaign.name,
        campaign.template?.code,
        metadata,
      ),
      channels: channels || '—',
      audience: campaign.audienceType,
      createdBy: createdBy?.displayName || createdBy?.email || '—',
      createdAt: formatStamp(campaign.createdAt),
      scheduledAt: formatStamp(campaign.scheduledAt),
      sentAt: formatStamp(campaign.sentAt),
      subject: campaign.subject || campaign.name,
      body: plainBody(campaign.bodyText, campaign.bodyHtml),
      total: campaign.delivery.recipients,
      confirmed: campaign.delivery.confirmed,
      accepted: campaign.delivery.accepted,
      pending: campaign.delivery.pending,
      failed: campaign.delivery.failed,
      opened: campaign.delivery.opened,
      recipients: rows.map(toReportRecipient),
      recipientTotal: total,
      truncated: total > rows.length,
    };
  }
}

type RawCampaignRecipient = {
  id: string;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  recipient_type: string;
  roll_number: string | null;
  staff_code: string | null;
  department: string | null;
  outcome: string | null;
  sent_at: Date | null;
  delivered_at: Date | null;
  opened_at: Date | null;
  read_at: Date | null;
  failure_reason: string | null;
  channel: string | null;
  photo_path: string | null;
  rendered_title: string | null;
  rendered_body: string | null;
};

function mapRecipient(row: RawCampaignRecipient) {
  return {
    id: row.id,
    name: row.display_name,
    email: row.email,
    phone: row.phone,
    rollNumber: row.roll_number,
    staffCode: row.staff_code,
    department: row.department,
    role: row.recipient_type,
    status: row.outcome ?? 'PENDING',
    sentAt: iso(row.sent_at),
    deliveredAt: iso(row.delivered_at),
    openedAt: iso(row.opened_at ?? row.read_at),
    failureReason: row.failure_reason,
    channel: row.channel,
    photoPath: row.photo_path,
    renderedTitle: row.rendered_title,
    renderedBody: row.rendered_body,
  };
}

function toReportRecipient(
  row: ReturnType<typeof mapRecipient>,
): CampaignReportRecipient {
  return {
    name: row.name || 'Unknown recipient',
    email: row.email || '',
    identifier: row.rollNumber || row.staffCode || '',
    department: row.department || '',
    role: row.role,
    status: row.status,
    sentAt: row.sentAt || '',
    deliveredAt: row.deliveredAt || '',
    failureReason: row.failureReason || '',
  };
}

function plainBody(bodyText?: string | null, bodyHtml?: string | null) {
  if (bodyText?.trim()) return bodyText.trim();
  return (bodyHtml ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim();
}

function campaignTypeLabel(
  name: string,
  code: string | undefined,
  metadata: Record<string, unknown>,
) {
  const source = `${code ?? ''} ${name}`.toUpperCase();
  const kind =
    source.includes('SECURITY') || source.includes('PASSWORD')
      ? 'Security'
      : source.includes('EVENT')
        ? 'Events'
        : 'Notice';
  return metadata.trigger ? `${kind} · Automated` : `${kind} · Manual`;
}

function formatStamp(value?: Date | null) {
  if (!value) return '—';
  return value.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function iso(value?: Date | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function growth(current: number, previous: number) {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
