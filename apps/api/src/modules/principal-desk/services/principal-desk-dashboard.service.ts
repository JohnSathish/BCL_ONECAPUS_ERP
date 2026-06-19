import { Injectable } from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { DashboardAnalyticsService } from '../../dashboard-analytics/dashboard-analytics.service';
import { NaacDashboardService } from '../../naac-iqac/services/naac-dashboard.service';
import { GovernanceDashboardService } from '../../governance/services/governance-dashboard.service';
import { governanceDb } from '../../governance/services/governance-prisma.util';
import { getZonedHour } from '../../../common/utils/time-greeting';

@Injectable()
export class PrincipalDeskDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboard: DashboardAnalyticsService,
    private readonly naac: NaacDashboardService,
    private readonly governance: GovernanceDashboardService,
  ) {}

  async getDashboard(user: JwtUser) {
    const tenantId = user.tid;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const [
      ops,
      libraryOverdueStudents,
      pendingStudentLeave,
      naacBrief,
      govBrief,
      libraryStats,
      committeeActivity,
      meetingsToday,
    ] = await Promise.all([
      this.dashboard.getOperationsCenter(tenantId, {}, user),
      this.countLibraryOverdueStudents(tenantId),
      this.prisma.studentLeaveApplication
        .count({ where: { tenantId, status: 'PENDING' } })
        .catch(() => 0),
      this.naac.dashboard(tenantId).catch(() => null),
      this.governance.dashboard(tenantId).catch(() => null),
      this.libraryTodayStats(tenantId, today),
      this.committeePendingByName(tenantId),
      this.countMeetingsToday(tenantId, today, endOfDay),
    ]);

    const pendingStaffLeave =
      ops.actions.find((a: { id: string }) => a.id === 'leave')?.count ?? 0;
    const feeDefaulters = ops.finance.defaulters;
    const attendanceRisk =
      ops.actions.find((a) => a.id === 'attendance')?.count ?? 0;

    const studentPresentPct =
      ops.institution.studentCount > 0
        ? Math.round(
            (ops.academic.studentsPresent / ops.institution.studentCount) *
              1000,
          ) / 10
        : 0;
    const facultyPresentPct = ops.academic.facultyAttendancePct;

    const campusHealthScore = this.computeCampusHealth({
      studentAttendancePct:
        ops.academic.studentAttendancePct || studentPresentPct,
      facultyAttendancePct: facultyPresentPct,
      collectionRate: ops.finance.collectionRate,
      libraryOverdue: libraryOverdueStudents,
      studentCount: ops.institution.studentCount,
      feeDefaulters,
    });

    const intelligenceSummary = this.buildIntelligenceSummary({
      hour: getZonedHour(new Date()),
      feeDefaulters,
      pendingDues: ops.finance.pendingDues,
      attendanceRisk,
      staffAbsent: ops.academic.facultyAbsent,
      pendingLeave: pendingStaffLeave + pendingStudentLeave,
      meetingsToday,
      libraryOverdueStudents,
      libraryOverdueBooks: libraryStats.overdueBooks,
      aiInsights: ops.aiInsights,
      govBrief,
    });

    const eventTimeline = this.buildEventTimeline(
      ops.upcomingEvents,
      govBrief?.upcomingMeetings ?? [],
    );

    return {
      greeting: ops.greeting,
      updatedAt: ops.updatedAt,
      institution: ops.institution,
      snapshot: {
        totalStudents: ops.institution.studentCount,
        studentsPresentToday: ops.academic.studentsPresent,
        studentsAbsentToday: ops.academic.studentsAbsent,
        staffPresentToday: ops.academic.facultyPresent,
        staffAbsentToday: ops.academic.facultyAbsent,
        classesConductedToday: ops.academic.classesCompleted,
        feeDefaulters,
        libraryOverdueStudents,
        leaveRequestsPending: pendingStaffLeave + pendingStudentLeave,
        pendingStaffLeave,
        pendingStudentLeave,
        upcomingEvents: ops.upcomingEvents?.length ?? 0,
      },
      pulse: ops.pulse,
      academic: ops.academic,
      finance: ops.finance,
      actions: ops.actions,
      upcomingEvents: ops.upcomingEvents,
      eventTimeline,
      announcements: ops.announcements,
      aiInsights: ops.aiInsights,
      intelligenceSummary,
      criticalAlerts: {
        attendanceRisk: {
          count: attendanceRisk,
          label: 'Below 75%',
          href: '/principal-desk/attendance',
        },
        feeDefaulters: {
          count: feeDefaulters,
          amount: ops.finance.pendingDues,
          href: '/principal-desk/fees',
        },
        libraryOverdue: {
          count: libraryOverdueStudents,
          books: libraryStats.overdueBooks,
          href: '/principal-desk/health',
        },
        leavePending: {
          count: pendingStaffLeave + pendingStudentLeave,
          href: '/principal-desk/leave',
        },
        committeeMeetingsToday: {
          count: meetingsToday,
          href: '/principal-desk/committees',
        },
        staffAbsentToday: {
          count: ops.academic.facultyAbsent,
          href: '/principal-desk/staff',
        },
      },
      operations: {
        library: libraryStats,
        activeOnCampus:
          ops.academic.studentsPresent + ops.academic.facultyPresent,
        studentPresentPct,
        facultyPresentPct,
      },
      campusHealth: {
        score: campusHealthScore,
        band:
          campusHealthScore >= 80
            ? 'green'
            : campusHealthScore >= 60
              ? 'orange'
              : 'red',
        factors: {
          attendance: ops.academic.studentAttendancePct || studentPresentPct,
          fees: ops.finance.collectionRate,
          library:
            libraryOverdueStudents === 0
              ? 100
              : Math.max(
                  0,
                  100 -
                    Math.min(
                      100,
                      Math.round(
                        (libraryOverdueStudents /
                          Math.max(1, ops.institution.studentCount)) *
                          500,
                      ),
                    ),
                ),
          staff: facultyPresentPct,
        },
      },
      committeeActivity,
      alerts: {
        committeePendingAtr: govBrief?.pendingAtr ?? 0,
        committeeOverdueAtr: govBrief?.overdueAtr ?? 0,
        naacReadiness: naacBrief?.overallReadiness ?? null,
        naacAqarStatus: naacBrief?.aqarStatus ?? null,
        scheduledMeetings: govBrief?.scheduledMeetings ?? 0,
        openTasks: govBrief?.openTasks ?? 0,
      },
    };
  }

  private computeCampusHealth(input: {
    studentAttendancePct: number;
    facultyAttendancePct: number;
    collectionRate: number;
    libraryOverdue: number;
    studentCount: number;
    feeDefaulters: number;
  }) {
    const libraryScore =
      input.libraryOverdue === 0
        ? 100
        : Math.max(
            0,
            100 -
              Math.min(
                50,
                Math.round(
                  (input.libraryOverdue / Math.max(1, input.studentCount)) *
                    200,
                ),
              ),
          );
    const feeScore = Math.min(100, input.collectionRate);
    const attendanceScore = Math.min(100, input.studentAttendancePct);
    const staffScore = Math.min(100, input.facultyAttendancePct);

    const raw =
      attendanceScore * 0.3 +
      staffScore * 0.2 +
      feeScore * 0.3 +
      libraryScore * 0.2;

    return Math.round(Math.min(100, Math.max(0, raw)));
  }

  private buildIntelligenceSummary(input: {
    hour: number;
    feeDefaulters: number;
    pendingDues: number;
    attendanceRisk: number;
    staffAbsent: number;
    pendingLeave: number;
    meetingsToday: number;
    libraryOverdueStudents: number;
    libraryOverdueBooks: number;
    aiInsights: string[];
    govBrief: {
      upcomingMeetings?: Array<{
        committee?: { name?: string };
        meetingDate?: Date | string;
      }>;
    } | null;
  }) {
    const salutation =
      input.hour < 12
        ? 'Good morning'
        : input.hour < 17
          ? 'Good afternoon'
          : 'Good evening';

    const bullets: string[] = [];
    if (input.feeDefaulters > 0) {
      bullets.push(
        `${input.feeDefaulters} students have pending fees (₹${Math.round(input.pendingDues).toLocaleString('en-IN')} outstanding).`,
      );
    }
    if (input.attendanceRisk > 0) {
      bullets.push(
        `${input.attendanceRisk} students are below 75% attendance.`,
      );
    }
    if (input.staffAbsent > 0) {
      bullets.push(`${input.staffAbsent} staff members are absent today.`);
    }
    if (input.pendingLeave > 0) {
      bullets.push(`${input.pendingLeave} leave requests await your approval.`);
    }
    const nextMeeting = input.govBrief?.upcomingMeetings?.[0];
    if (nextMeeting?.committee?.name) {
      const when = nextMeeting.meetingDate
        ? new Date(nextMeeting.meetingDate).toLocaleDateString('en-IN', {
            weekday: 'long',
            day: 'numeric',
            month: 'short',
          })
        : 'soon';
      bullets.push(`${nextMeeting.committee.name} meeting scheduled ${when}.`);
    } else if (input.meetingsToday > 0) {
      bullets.push(
        `${input.meetingsToday} committee meetings scheduled today.`,
      );
    }
    if (input.libraryOverdueBooks > 0) {
      bullets.push(
        `${input.libraryOverdueBooks} library books are overdue across ${input.libraryOverdueStudents} students.`,
      );
    }
    if (!bullets.length) {
      for (const insight of input.aiInsights.slice(0, 3)) {
        bullets.push(insight);
      }
      if (!bullets.length) {
        bullets.push(
          'No critical risks detected — college operations are on track.',
        );
      }
    }

    return { salutation, bullets: bullets.slice(0, 5) };
  }

  private buildEventTimeline(
    opsEvents: Array<{ date: string; label: string; href?: string }>,
    govMeetings: Array<{
      meetingDate?: Date | string;
      committee?: { name?: string; shortCode?: string };
      agenda?: string | null;
    }>,
  ) {
    const items: Array<{
      dayGroup: string;
      time: string;
      label: string;
      href?: string;
    }> = [];

    const now = new Date();
    const todayStr = now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toDateString();

    for (const m of govMeetings) {
      if (!m.meetingDate) continue;
      const d = new Date(m.meetingDate);
      const dayGroup =
        d.toDateString() === todayStr
          ? 'Today'
          : d.toDateString() === tomorrowStr
            ? 'Tomorrow'
            : d.toLocaleDateString('en-IN', {
                weekday: 'long',
                day: 'numeric',
                month: 'short',
              });
      items.push({
        dayGroup,
        time: d.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        label:
          m.committee?.name ?? m.committee?.shortCode ?? 'Committee Meeting',
        href: '/principal-desk/committees',
      });
    }

    for (const e of opsEvents) {
      items.push({
        dayGroup: 'Upcoming',
        time: e.date,
        label: e.label,
        href: e.href ?? '/principal-desk/events',
      });
    }

    return items.slice(0, 8);
  }

  private async libraryTodayStats(tenantId: string, today: Date) {
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const [issuedToday, returnsToday, overdueBooks] = await Promise.all([
      this.prisma.libraryLoan.count({
        where: { tenantId, issuedAt: { gte: today, lte: endOfDay } },
      }),
      this.prisma.libraryLoan.count({
        where: { tenantId, returnedAt: { gte: today, lte: endOfDay } },
      }),
      this.prisma.libraryLoan.count({
        where: {
          tenantId,
          status: 'ACTIVE',
          dueAt: { lt: today },
        },
      }),
    ]);

    return { issuedToday, returnsToday, overdueBooks };
  }

  private async countMeetingsToday(tenantId: string, start: Date, end: Date) {
    try {
      const db = governanceDb(this.prisma);
      return db.governanceMeeting.count({
        where: {
          tenantId,
          status: 'SCHEDULED',
          meetingDate: { gte: start, lte: end },
        },
      });
    } catch {
      return 0;
    }
  }

  private async committeePendingByName(tenantId: string) {
    try {
      const db = governanceDb(this.prisma);
      const committees = await db.governanceCommittee.findMany({
        where: { tenantId, status: 'ACTIVE' },
        select: { id: true, name: true, shortCode: true },
        orderBy: { name: 'asc' },
        take: 12,
      });

      const rows = await Promise.all(
        committees.map(
          async (c: { id: string; name: string; shortCode: string }) => {
            const pending = await db.governanceTask.count({
              where: {
                tenantId,
                committeeId: c.id,
                status: { in: ['PENDING', 'IN_PROGRESS'] },
              },
            });
            return {
              id: c.id,
              name: c.shortCode || c.name,
              pending,
              href: '/principal-desk/committees',
            };
          },
        ),
      );

      return rows
        .filter((r) => r.pending > 0 || rows.length <= 6)
        .sort((a, b) => b.pending - a.pending)
        .slice(0, 8);
    } catch {
      return [];
    }
  }

  private async countLibraryOverdueStudents(tenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const rows = await this.prisma.libraryLoan.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        dueAt: { lt: today },
        studentId: { not: null },
      },
      select: { studentId: true },
      distinct: ['studentId'],
    });
    return rows.length;
  }
}
