import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../database/prisma.service';
import { CommunicationTriggerService } from '../../communication/services/communication-trigger.service';
import type { ResolvedRecipient } from '../../communication/services/communication-audience.service';
import { RecruitmentNotificationService } from './recruitment-notification.service';

@Injectable()
export class HrSchedulerService {
  private readonly logger = new Logger(HrSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly triggers: CommunicationTriggerService,
    private readonly recruitmentNotifications: RecruitmentNotificationService,
  ) {}

  @Cron('0 7 * * *')
  async runRecruitmentReminders() {
    this.logger.log('Running daily recruitment reminder scan');
    const tenants = await this.prisma.tenant.findMany({
      where: { status: 'active', deletedAt: null },
      select: { id: true },
    });

    for (const tenant of tenants) {
      await this.scanInterviewReminders(tenant.id);
      await this.scanJoiningReminders(tenant.id);
    }
  }

  private dayWindow(offsetDays: number) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() + offsetDays);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }

  async scanInterviewReminders(tenantId: string) {
    const { start, end } = this.dayWindow(1);
    const interviews = await this.prisma.recruitmentInterview.findMany({
      where: {
        tenantId,
        status: 'SCHEDULED',
        scheduledAt: { gte: start, lt: end },
      },
      include: {
        application: {
          include: { vacancy: { select: { title: true } } },
        },
      },
      take: 100,
    });

    for (const interview of interviews) {
      await this.recruitmentNotifications.interviewReminder(
        tenantId,
        interview.id,
        interview.application,
        interview,
      );
    }
  }

  async scanJoiningReminders(tenantId: string) {
    const { start, end } = this.dayWindow(3);
    const orders = await this.prisma.appointmentOrder.findMany({
      where: {
        tenantId,
        status: { in: ['SENT', 'ACCEPTED'] },
        joiningDate: { gte: start, lt: end },
      },
      include: {
        application: {
          include: { vacancy: { select: { title: true } } },
        },
      },
      take: 100,
    });

    for (const order of orders) {
      if (!order.joiningDate) continue;
      await this.recruitmentNotifications.joiningReminder(
        tenantId,
        order.id,
        order.application,
        order.joiningDate,
      );
    }
  }

  @Cron('0 8 * * *')
  async runProbationReminders() {
    this.logger.log('Running daily probation end reminder scan');
    const tenants = await this.prisma.tenant.findMany({
      where: { status: 'active', deletedAt: null },
      select: { id: true },
    });

    for (const tenant of tenants) {
      await this.scanTenantProbationReminders(tenant.id);
    }
  }

  async scanTenantProbationReminders(tenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const windows = [
      { days: 30, triggerKey: 'hr.probation.30d' },
      { days: 15, triggerKey: 'hr.probation.15d' },
      { days: 7, triggerKey: 'hr.probation.7d' },
    ];

    const institutionName = await this.triggers.getInstitutionName(tenantId);

    for (const window of windows) {
      const target = new Date(today);
      target.setDate(target.getDate() + window.days);

      const staff = await this.prisma.staffProfile.findMany({
        where: {
          tenantId,
          deletedAt: null,
          status: 'ACTIVE',
          probationEndDate: target,
          confirmationDate: null,
        },
        include: {
          department: { select: { name: true } },
        },
        take: 200,
      });

      for (const member of staff) {
        const hrUsers = await this.prisma.user.findMany({
          where: {
            tenantId,
            deletedAt: null,
            roles: {
              some: {
                role: {
                  slug: { in: ['college-admin', 'principal', 'hr-manager'] },
                },
              },
            },
          },
          select: { id: true, email: true, displayName: true },
          take: 10,
        });

        for (const hr of hrUsers) {
          const recipient: ResolvedRecipient = {
            recipientType: 'USER',
            userId: hr.id,
            displayName: hr.displayName ?? hr.email,
            email: hr.email,
          };

          await this.triggers.trigger({
            tenantId,
            templateCode: 'HR_PROBATION_REMINDER',
            triggerKey: window.triggerKey,
            entityType: 'staff_profile',
            entityId: member.id,
            recipient,
            variables: {
              staff_name: member.fullName,
              employee_code: member.employeeCode ?? '',
              department: member.department?.name ?? '',
              probation_end_date: member.probationEndDate
                ? member.probationEndDate.toISOString().slice(0, 10)
                : '',
              days_remaining: String(window.days),
              institution_name: institutionName,
            },
            channels: ['IN_APP', 'EMAIL'],
          });
        }
      }
    }
  }
}
