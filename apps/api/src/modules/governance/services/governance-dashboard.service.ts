import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { governanceDb } from './governance-prisma.util';

@Injectable()
export class GovernanceDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return governanceDb(this.prisma);
  }

  async dashboard(tenantId: string) {
    const db = this.db();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      activeCommittees,
      scheduledMeetings,
      pendingAtr,
      overdueAtr,
      openTasks,
      draftNotices,
      upcomingMeetings,
      recentNotices,
    ] = await Promise.all([
      db.governanceCommittee.count({ where: { tenantId, status: 'ACTIVE' } }),
      db.governanceMeeting.count({
        where: { tenantId, status: 'SCHEDULED', meetingDate: { gte: now } },
      }),
      db.governanceActionItem.count({
        where: { tenantId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
      }),
      db.governanceActionItem.count({
        where: {
          tenantId,
          status: { in: ['PENDING', 'IN_PROGRESS', 'OVERDUE'] },
          targetDate: { lt: now },
        },
      }),
      db.governanceTask.count({
        where: { tenantId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
      }),
      db.governanceNotice.count({ where: { tenantId, status: 'DRAFT' } }),
      db.governanceMeeting.findMany({
        where: { tenantId, status: 'SCHEDULED', meetingDate: { gte: now } },
        include: { committee: { select: { name: true, shortCode: true } } },
        orderBy: { meetingDate: 'asc' },
        take: 5,
      }),
      db.governanceNotice.findMany({
        where: {
          tenantId,
          status: 'PUBLISHED',
          publishedAt: { gte: startOfMonth },
        },
        orderBy: { publishedAt: 'desc' },
        take: 5,
      }),
    ]);

    const meetingsThisMonth = await db.governanceMeeting.count({
      where: { tenantId, meetingDate: { gte: startOfMonth } },
    });

    const performanceSnapshots =
      await db.governancePerformanceSnapshot.findMany({
        where: { tenantId },
        orderBy: { scoreTotal: 'desc' },
        take: 5,
        include: { committee: { select: { name: true, shortCode: true } } },
      });

    return {
      activeCommittees,
      scheduledMeetings,
      meetingsThisMonth,
      pendingAtr,
      overdueAtr,
      openTasks,
      draftNotices,
      upcomingMeetings,
      recentNotices,
      topPerformers: performanceSnapshots,
    };
  }
}
