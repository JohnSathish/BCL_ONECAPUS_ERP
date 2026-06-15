import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CommunicationEmailService } from '../../communication/services/communication-email.service';
import { UserNotificationsService } from '../../communication/services/user-notifications.service';
import { GovernanceSettingsService } from './governance-settings.service';
import { governanceDb } from './governance-prisma.util';

@Injectable()
export class GovernanceNotificationService {
  private readonly logger = new Logger(GovernanceNotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: UserNotificationsService,
    private readonly email: CommunicationEmailService,
    private readonly settings: GovernanceSettingsService,
  ) {}

  private db() {
    return governanceDb(this.prisma);
  }

  async notifyNoticePublished(
    tenantId: string,
    notice: Record<string, unknown>,
  ) {
    const cfg = await this.settings.get(tenantId);
    const recipients = await this.resolveNoticeRecipients(
      tenantId,
      String(notice.audience ?? 'COMMITTEE'),
      notice.committeeId as string | undefined,
    );

    for (const recipient of recipients) {
      if (cfg.notifyInApp && recipient.userId) {
        await this.notifications.createInApp({
          tenantId,
          userId: recipient.userId,
          type: 'GOVERNANCE_NOTICE',
          title: String(notice.title),
          body: String(notice.body).slice(0, 500),
          link: '/admin/governance/notices',
          metadata: { noticeId: notice.id, noticeNo: notice.noticeNo },
        });
      }

      if (cfg.notifyEmail && recipient.email) {
        await this.email.send({
          to: recipient.email,
          subject: `[Governance] ${notice.noticeNo ?? notice.title}`,
          html: `<p>${String(notice.body).replace(/\n/g, '<br/>')}</p>`,
          text: String(notice.body),
        });
      }
    }

    return { notified: recipients.length };
  }

  async notifyMeetingScheduled(tenantId: string, meetingId: string) {
    const meeting = await this.db().governanceMeeting.findFirst({
      where: { id: meetingId, tenantId },
      include: { committee: { select: { name: true } } },
    });
    if (!meeting) return { notified: 0 };

    const members = await this.db().governanceCommitteeMember.findMany({
      where: {
        tenantId,
        committeeId: meeting.committeeId,
        status: 'ACTIVE',
        userId: { not: null },
      },
    });

    const cfg = await this.settings.get(tenantId);
    for (const member of members) {
      if (!member.userId) continue;
      if (cfg.notifyInApp) {
        await this.notifications.createInApp({
          tenantId,
          userId: member.userId,
          type: 'GOVERNANCE_MEETING',
          title: `Meeting scheduled: ${meeting.title}`,
          body: `${meeting.committee.name} on ${new Date(meeting.meetingDate).toLocaleDateString('en-IN')}`,
          link: '/admin/governance/meetings',
          metadata: { meetingId: meeting.id },
        });
      }
    }

    return { notified: members.length };
  }

  async notifyAtrAssigned(tenantId: string, actionItemId: string) {
    const item = await this.db().governanceActionItem.findFirst({
      where: { id: actionItemId, tenantId },
    });
    if (!item?.assignedToId) return { notified: 0 };

    const cfg = await this.settings.get(tenantId);
    if (cfg.notifyInApp) {
      await this.notifications.createInApp({
        tenantId,
        userId: item.assignedToId,
        type: 'GOVERNANCE_ATR',
        title: 'Action item assigned',
        body: item.actionItem.slice(0, 500),
        link: '/admin/governance/atr',
        metadata: { actionItemId: item.id },
      });
    }

    const user = await this.prisma.user.findFirst({
      where: { id: item.assignedToId, tenantId },
    });
    if (cfg.notifyEmail && user?.email) {
      await this.email.send({
        to: user.email,
        subject: '[Governance] Action item assigned',
        text: item.actionItem,
      });
    }

    return { notified: 1 };
  }

  private async resolveNoticeRecipients(
    tenantId: string,
    audience: string,
    committeeId?: string,
  ): Promise<Array<{ userId?: string; email?: string }>> {
    if (audience === 'COMMITTEE' && committeeId) {
      const members = await this.db().governanceCommitteeMember.findMany({
        where: { tenantId, committeeId, status: 'ACTIVE' },
      });
      return members.map((m: Record<string, unknown>) => ({
        userId: m.userId as string | undefined,
        email: m.email as string | undefined,
      }));
    }

    if (audience === 'STAFF' || audience === 'ALL') {
      const staffUsers = await this.prisma.userRole.findMany({
        where: {
          deletedAt: null,
          role: {
            tenantId,
            slug: { in: ['college-admin', 'staff', 'faculty'] },
          },
        },
        include: { user: { select: { id: true, email: true } } },
        take: 200,
      });
      return staffUsers
        .filter((row) => row.user)
        .map((row) => ({
          userId: row.user!.id,
          email: row.user!.email ?? undefined,
        }));
    }

    if (audience === 'STUDENTS') {
      const students = await this.prisma.userRole.findMany({
        where: { deletedAt: null, role: { tenantId, slug: 'student' } },
        include: { user: { select: { id: true, email: true } } },
        take: 200,
      });
      return students
        .filter((row) => row.user)
        .map((row) => ({
          userId: row.user!.id,
          email: row.user!.email ?? undefined,
        }));
    }

    this.logger.debug(`No explicit recipients for audience ${audience}`);
    return [];
  }
}
