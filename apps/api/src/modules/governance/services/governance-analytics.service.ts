import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { academicYearLabel } from '../constants/governance.constants';
import type { AnalyticsQueryDto } from '../dto/governance.dto';
import { governanceDb } from './governance-prisma.util';

@Injectable()
export class GovernanceAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return governanceDb(this.prisma);
  }

  async overview(tenantId: string, query: AnalyticsQueryDto) {
    const year = query.academicYear ?? academicYearLabel();
    const yearStart = this.academicYearStart(year);
    const yearEnd = this.academicYearEnd(year);

    const meetingWhere: Record<string, unknown> = {
      tenantId,
      meetingDate: { gte: yearStart, lte: yearEnd },
    };
    if (query.committeeId) meetingWhere.committeeId = query.committeeId;

    const [
      meetingsHeld,
      meetingsScheduled,
      atrCompleted,
      atrPending,
      tasksCompleted,
      documentsUploaded,
      eventsHeld,
    ] = await Promise.all([
      this.db().governanceMeeting.count({
        where: { ...meetingWhere, status: 'COMPLETED' },
      }),
      this.db().governanceMeeting.count({
        where: { ...meetingWhere, status: 'SCHEDULED' },
      }),
      this.db().governanceActionItem.count({
        where: {
          tenantId,
          status: 'COMPLETED',
          ...(query.committeeId ? { committeeId: query.committeeId } : {}),
        },
      }),
      this.db().governanceActionItem.count({
        where: {
          tenantId,
          status: { in: ['PENDING', 'IN_PROGRESS', 'OVERDUE'] },
          ...(query.committeeId ? { committeeId: query.committeeId } : {}),
        },
      }),
      this.db().governanceTask.count({
        where: {
          tenantId,
          status: 'COMPLETED',
          ...(query.committeeId ? { committeeId: query.committeeId } : {}),
        },
      }),
      this.db().governanceDocument.count({
        where: {
          tenantId,
          ...(query.committeeId ? { committeeId: query.committeeId } : {}),
        },
      }),
      this.db().governanceEvent.count({
        where: {
          tenantId,
          status: 'COMPLETED',
          startDate: { gte: yearStart, lte: yearEnd },
          ...(query.committeeId ? { committeeId: query.committeeId } : {}),
        },
      }),
    ]);

    const categoryBreakdown = await this.db().governanceCommittee.groupBy({
      by: ['category'],
      where: { tenantId, status: 'ACTIVE' },
      _count: { _all: true },
    });

    const monthlyMeetings = await this.monthlyMeetingTrend(
      tenantId,
      yearStart,
      yearEnd,
      query.committeeId,
    );

    return {
      academicYear: year,
      meetingsHeld,
      meetingsScheduled,
      atrCompleted,
      atrPending,
      tasksCompleted,
      documentsUploaded,
      eventsHeld,
      categoryBreakdown,
      monthlyMeetings,
    };
  }

  async committeeComparison(tenantId: string, academicYear?: string) {
    const year = academicYear ?? academicYearLabel();
    const snapshots = await this.db().governancePerformanceSnapshot.findMany({
      where: { tenantId, academicYear: year },
      include: {
        committee: { select: { name: true, shortCode: true, category: true } },
      },
      orderBy: { scoreTotal: 'desc' },
    });

    return snapshots.map((s: Record<string, unknown>) => ({
      committeeId: (s.committee as { id?: string }).id ?? s.committeeId,
      shortCode: (s.committee as { shortCode: string }).shortCode,
      name: (s.committee as { name: string }).name,
      category: (s.committee as { category: string }).category,
      scoreTotal: s.scoreTotal,
      scoreBreakdown: s.scoreBreakdown,
    }));
  }

  private async monthlyMeetingTrend(
    tenantId: string,
    from: Date,
    to: Date,
    committeeId?: string,
  ) {
    const meetings = await this.db().governanceMeeting.findMany({
      where: {
        tenantId,
        meetingDate: { gte: from, lte: to },
        ...(committeeId ? { committeeId } : {}),
      },
      select: { meetingDate: true, status: true },
    });

    const buckets = new Map<string, { scheduled: number; completed: number }>();
    for (const meeting of meetings) {
      const key = `${meeting.meetingDate.getFullYear()}-${String(meeting.meetingDate.getMonth() + 1).padStart(2, '0')}`;
      const row = buckets.get(key) ?? { scheduled: 0, completed: 0 };
      if (meeting.status === 'COMPLETED') row.completed += 1;
      else row.scheduled += 1;
      buckets.set(key, row);
    }

    return [...buckets.entries()].map(([month, counts]) => ({
      month,
      ...counts,
    }));
  }

  private academicYearStart(label: string) {
    const startYear = Number(label.split('-')[0]);
    return new Date(startYear, 5, 1);
  }

  private academicYearEnd(label: string) {
    const startYear = Number(label.split('-')[0]);
    return new Date(startYear + 1, 4, 30, 23, 59, 59);
  }
}
