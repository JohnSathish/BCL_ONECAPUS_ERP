import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../database/prisma.service';
import type { ResolvedRecipient } from './communication-audience.service';
import { CommunicationTriggerService } from './communication-trigger.service';
import { CommunicationCampaignsService } from './communication-campaigns.service';

@Injectable()
export class CommunicationSchedulerService {
  private readonly logger = new Logger(CommunicationSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly triggers: CommunicationTriggerService,
    private readonly campaigns: CommunicationCampaignsService,
  ) {}

  @Cron('*/5 * * * *')
  async runScheduledCampaigns() {
    const due = await this.prisma.communicationCampaign.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: { lte: new Date() },
      },
      take: 20,
      select: { id: true, tenantId: true, createdById: true },
    });

    for (const campaign of due) {
      try {
        await this.campaigns.sendScheduled(
          campaign.tenantId,
          campaign.id,
          campaign.createdById ?? undefined,
        );
        this.logger.log(`Sent scheduled campaign ${campaign.id}`);
      } catch (err) {
        this.logger.error(
          `Failed scheduled campaign ${campaign.id}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
  }

  @Cron('0 8 * * *')
  async runFeeDueReminders() {
    this.logger.log('Running daily fee due reminder scan');
    const tenants = await this.prisma.tenant.findMany({
      where: { status: 'active', deletedAt: null },
      select: { id: true },
    });

    for (const tenant of tenants) {
      await this.scanTenantFeeReminders(tenant.id);
    }
  }

  async scanTenantFeeReminders(tenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const windows = [
      { days: 0, triggerKey: 'fee.due_today' },
      { days: 3, triggerKey: 'fee.due_3d' },
      { days: 7, triggerKey: 'fee.due_7d' },
    ];

    for (const window of windows) {
      const target = new Date(today);
      target.setDate(target.getDate() + window.days);

      const demands = await this.prisma.studentFeeDemand.findMany({
        where: {
          tenantId,
          status: { in: ['PUBLISHED', 'LOCKED', 'PARTIALLY_PAID'] },
          balanceAmount: { gt: 0 },
          dueDate: target,
        },
        take: 500,
      });

      for (const demand of demands) {
        const student = await this.prisma.student.findFirst({
          where: { id: demand.studentId, tenantId, deletedAt: null },
          include: {
            user: { select: { id: true, email: true, displayName: true } },
            masterProfile: {
              select: { fullName: true, email: true, mobileNumber: true },
            },
          },
        });
        if (!student?.user) continue;

        const institutionName =
          await this.triggers.getInstitutionName(tenantId);
        const recipient: ResolvedRecipient = {
          recipientType: 'STUDENT',
          userId: student.userId,
          studentId: student.id,
          displayName:
            student.masterProfile?.fullName ??
            student.user.displayName ??
            student.user.email,
          email: student.masterProfile?.email ?? student.user.email,
          phone: student.masterProfile?.mobileNumber ?? undefined,
        };

        await this.triggers.trigger({
          tenantId,
          templateCode: 'FEE_REMINDER',
          triggerKey: window.triggerKey,
          entityType: 'fee_demand',
          entityId: demand.id,
          recipient,
          variables: {
            student_name: recipient.displayName,
            amount: String(demand.balanceAmount),
            due_date: demand.dueDate
              ? demand.dueDate.toISOString().slice(0, 10)
              : '',
            demand_no: demand.demandNo,
            institution_name: institutionName,
          },
          channels: ['EMAIL', 'IN_APP'],
        });
      }
    }
  }
}
