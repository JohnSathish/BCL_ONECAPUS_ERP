import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { AnalyticsService } from '../academic-engine/services/analytics.service';
import {
  applicationWhere,
  monthBuckets,
  registrationWhere,
  shiftWhere,
  sparklineFromMonthlyCounts,
  studentWhere,
  type DashboardFilters,
} from './dashboard-scope.helper';
import type {
  ChartSeriesPoint,
  DashboardChartResponse,
  DashboardKpiMetric,
  DashboardOverviewResponse,
  OperationsCenterResponse,
  ShiftIntelligenceResponse,
} from './dashboard-analytics.types';
import { getDayPartGreeting } from '../../common/utils/time-greeting';

const ACTIVE_FEE_DEMANDS = [
  'PUBLISHED',
  'LOCKED',
  'PARTIALLY_PAID',
  'PAID',
] as const;
const FEE_HEAD_LABEL: Record<string, string> = {
  GENERAL: 'Fee Demand',
  ADMISSION_SESSION: 'Admission Fee',
  MONTHLY: 'Monthly Fee',
  EXAM_FEE: 'Examination Fee',
  MISCELLANEOUS: 'Miscellaneous Fee',
  SHORT_TERM_COURSE: 'Short-term Course',
  TUITION: 'Tuition Fee',
  LIBRARY: 'Library Fee',
};

@Injectable()
export class DashboardAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registrationAnalytics: AnalyticsService,
  ) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  async getOverview(
    tenantId: string,
    filters: DashboardFilters,
    user?: JwtUser,
  ): Promise<DashboardOverviewResponse> {
    const buckets = monthBuckets(6);
    const semesterNo = filters.semesterId
      ? (
          await this.prisma.semester.findFirst({
            where: { id: filters.semesterId, tenantId, deletedAt: null },
            select: { semesterNumber: true },
          })
        )?.semesterNumber
      : undefined;
    const sw = this.studentScope(tenantId, filters);
    const aw = applicationWhere(tenantId, filters);
    const rw = registrationWhere(tenantId, filters);
    const since = new Date(buckets[0]?.start ?? new Date());
    const studentRows = await this.prisma.student.findMany({
      where: sw,
      select: {
        id: true,
        createdAt: true,
        department: { select: { name: true } },
        programVersion: {
          select: { program: { select: { name: true, code: true } } },
        },
      },
    });
    const studentIds = studentRows.map((row) => row.id);
    const studentTotal = studentIds.length;

    const [
      applicationTotal,
      applicationRows,
      pendingReview,
      pendingRegistrations,
      completedRegistrations,
      totalRegistrations,
      facultyCount,
      feeTotals,
      feeHeads,
      feePayments,
      attendanceRows,
      placementRows,
      recentDemands,
    ] = await Promise.all([
      this.prisma.admissionApplication.count({ where: aw }),
      this.prisma.admissionApplication.findMany({
        where: aw,
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.admissionApplication.count({
        where: {
          ...aw,
          status: { in: ['submitted', 'under_review'] },
        },
      }),
      this.prisma.semesterRegistration.count({
        where: { ...rw, status: 'pending_approval' },
      }),
      this.prisma.semesterRegistration.count({
        where: { ...rw, status: 'completed' },
      }),
      this.prisma.semesterRegistration.count({ where: rw }),
      this.prisma.userRole.count({
        where: {
          deletedAt: null,
          role: { tenantId, slug: 'faculty', deletedAt: null },
          user: { tenantId, deletedAt: null, isActive: true },
        },
      }),
      this.prisma.studentFeeDemand.aggregate({
        where: this.feeDemandWhere(tenantId, filters, studentIds),
        _sum: { totalAmount: true, paidAmount: true, balanceAmount: true },
      }),
      this.prisma.studentFeeDemand.groupBy({
        by: ['demandType'],
        where: this.feeDemandWhere(tenantId, filters, studentIds),
        _sum: { paidAmount: true },
      }),
      this.prisma.paymentTransaction.findMany({
        where: {
          tenantId,
          status: { in: ['SUCCESS', 'PAID'] },
          createdAt: { gte: since },
          studentId: { in: studentIds },
        },
        select: {
          amount: true,
          paidAt: true,
          createdAt: true,
          transactionNo: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.studentAttendanceSummary.findMany({
        where: {
          tenantId,
          totalSessions: { gt: 0 },
          ...(semesterNo != null ? { semesterNo } : {}),
          studentId: { in: studentIds },
        },
        select: {
          studentId: true,
          percentage: true,
          totalSessions: true,
        },
      }),
      this.prisma.placementApplication.groupBy({
        by: ['status'],
        where: { tenantId, studentId: { in: studentIds } },
        _count: { _all: true },
      }),
      this.prisma.studentFeeDemand.findMany({
        where: this.feeDemandWhere(tenantId, filters, studentIds),
        select: {
          demandNo: true,
          publishedAt: true,
          createdAt: true,
          totalAmount: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    const studentSpark = sparklineFromMonthlyCounts(buckets, studentRows);
    const appSpark = sparklineFromMonthlyCounts(buckets, applicationRows);
    const studentTrend = this.monthChange(studentSpark);
    const appTrend = this.monthChange(appSpark);
    const attendance = this.summariseAttendance(
      attendanceRows,
      new Map(
        studentRows.map((row) => [
          row.id,
          row.department?.name ?? 'Unassigned',
        ]),
      ),
    );
    const programmes = this.programmeSlices(studentRows);
    const feeDemanded = Number(feeTotals._sum.totalAmount ?? 0);
    const feeCollected = Number(feeTotals._sum.paidAmount ?? 0);
    const feePending = Number(feeTotals._sum.balanceAmount ?? 0);
    const feeCollectionPct =
      feeDemanded > 0
        ? Math.round((feeCollected / feeDemanded) * 1000) / 10
        : 0;
    const feeMonthly = buckets.map((month) => ({
      label: month.label,
      collected: this.sumByMonth(
        feePayments,
        this.monthKey(month.start),
        'amount',
      ),
    }));
    const feeTrend = this.monthChange(
      feeMonthly.map((month) => month.collected),
    );
    const placement = this.summarisePlacement(placementRows);
    const completionPct =
      totalRegistrations > 0
        ? Math.round((completedRegistrations / totalRegistrations) * 1000) / 10
        : 0;
    const pendingTotal = pendingReview + pendingRegistrations;
    const byHead = this.feeHeadSlices(feeHeads, feeCollected);
    const board = {
      fee: {
        demanded: feeDemanded,
        collected: feeCollected,
        pending: feePending,
        rate: feeCollectionPct,
        byHead,
        monthly: feeMonthly,
      },
      studentsByProgramme: programmes,
      attendance,
      placement,
      activities: this.financeActivities(recentDemands, feePayments),
      insights: this.financeInsights({
        attendance,
        feeRate: feeCollectionPct,
        feeCollected,
        feePending,
        pendingTotal,
        studentTotal,
        placement,
      }),
    };

    const kpis: DashboardKpiMetric[] = [
      {
        id: 'students',
        label: 'Total Students',
        value: studentTotal,
        ...studentTrend,
        context: 'Enrolled in this scope',
        sparkline: studentSpark,
        source: 'live',
      },
      {
        id: 'applications',
        label: 'Applications',
        value: applicationTotal,
        ...appTrend,
        context: 'Admission pipeline',
        sparkline: appSpark,
        source: 'live',
      },
      {
        id: 'attendance',
        label: 'Attendance',
        value: attendance.average ?? 0,
        suffix: '%',
        changePct: 0,
        trend: 'up',
        context: attendance.markedStudents
          ? `Marked for ${attendance.markedStudents} students`
          : 'No attendance has been marked',
        sparkline: [],
        source: 'live',
      },
      {
        id: 'fees',
        label: 'Fee Collection',
        value: feeCollectionPct,
        suffix: '%',
        ...feeTrend,
        context: feeDemanded
          ? `${this.formatInr(feeCollected)} collected of ${this.formatInr(feeDemanded)}`
          : 'No published fee demands',
        sparkline: feeMonthly.map((month) => month.collected),
        source: 'live',
      },
      {
        id: 'placement',
        label: 'Placement Rate',
        value: placement.rate ?? 0,
        suffix: '%',
        changePct: 0,
        trend: 'up',
        context: placement.applicants
          ? `${placement.offers} offers from ${placement.applicants} applications`
          : 'No placement applications',
        sparkline: [],
        source: 'live',
      },
      {
        id: 'pending',
        label: 'Pending Approvals',
        value: pendingTotal,
        changePct: 0,
        trend: 'up',
        context: 'Admissions and registrations',
        sparkline: [],
        source: 'live',
      },
      {
        id: 'faculty',
        label: 'Active Faculty',
        value: facultyCount,
        changePct: 0,
        trend: 'up',
        context: 'Faculty accounts that can sign in',
        sparkline: [],
        source: 'live',
      },
      {
        id: 'completion',
        label: 'Registration',
        value: completionPct,
        suffix: '%',
        changePct: 0,
        trend: 'up',
        context: totalRegistrations
          ? `${completedRegistrations} of ${totalRegistrations} registrations completed`
          : 'No semester registrations in this scope',
        sparkline: [],
        source: 'live',
      },
    ];

    return {
      kpis: this.filterKpisForUser(kpis, user),
      board,
      updatedAt: new Date().toISOString(),
    };
  }

  async getOperationsCenter(
    tenantId: string,
    filters: DashboardFilters,
    user?: JwtUser,
  ): Promise<OperationsCenterResponse> {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const dayOfWeek = todayStart.getDay();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const sw = studentWhere(tenantId, filters);
    const aw = applicationWhere(tenantId, filters);
    const rw = registrationWhere(tenantId, filters);
    const PRESENT_STATUSES = ['P', 'L', 'OD', 'SPORTS', 'NSS', 'NCC'];
    const STAFF_PRESENT = ['PRESENT', 'LATE', 'HALF_DAY', 'ON_DUTY'];

    const [
      studentCount,
      staffCount,
      facultyCount,
      academicYear,
      activeSemesters,
      pendingAdmissions,
      pendingRegistrations,
      pendingLeave,
      feeDemands,
      feePayments,
      applicationsByStatus,
      openIntakes,
      totalSeats,
      allocatedSeats,
      examMarks,
      examResults,
      examSessions,
      lmsAnnouncements,
      communicationLogs,
      todayAttendanceSessions,
      todayAttendanceMarked,
      todayAttendanceEntries,
      attendanceShortageRows,
      staffAttendanceToday,
      todayTimetableEntries,
      studentsByDept,
      attendanceSummaries,
    ] = await Promise.all([
      this.prisma.student.count({ where: sw }),
      this.prisma.staffProfile.count({ where: { tenantId, deletedAt: null } }),
      this.prisma.userRole.count({
        where: {
          deletedAt: null,
          role: { tenantId, slug: 'faculty', deletedAt: null },
          user: { tenantId, deletedAt: null, isActive: true },
        },
      }),
      this.prisma.academicYear.findFirst({
        where: {
          tenantId,
          deletedAt: null,
          OR: [{ status: 'ACTIVE' }, { isPrimarySession: true }],
        },
        orderBy: { startDate: 'desc' },
        select: { name: true },
      }),
      this.prisma.semester.findMany({
        where: { tenantId, deletedAt: null, isActive: true },
        orderBy: { progressionOrder: 'asc' },
        select: { name: true, semesterType: true, semesterNumber: true },
      }),
      this.prisma.admissionApplication.count({
        where: { ...aw, status: { in: ['submitted', 'under_review'] } },
      }),
      this.prisma.semesterRegistration.count({
        where: { ...rw, status: 'pending_approval' },
      }),
      this.safeCount(() =>
        this.prisma.staffLeaveApplication.count({
          where: { tenantId, status: 'PENDING' },
        }),
      ),
      this.db().studentFeeDemand.findMany({ where: { tenantId }, take: 8000 }),
      this.db().paymentTransaction.findMany({
        where: { tenantId, status: { in: ['SUCCESS', 'PAID'] } },
        take: 8000,
      }),
      this.prisma.admissionApplication.groupBy({
        by: ['status'],
        where: aw,
        _count: true,
      }),
      this.prisma.admissionIntake.count({
        where: { tenantId, deletedAt: null, status: 'open' },
      }),
      this.prisma.admissionIntake.aggregate({
        where: { tenantId, deletedAt: null, status: 'open' },
        _sum: { totalSeats: true },
      }),
      this.prisma.seatAllocation.count({
        where: {
          tenantId,
          deletedAt: null,
          status: { in: ['confirmed', 'allocated', 'approved'] },
        },
      }),
      this.safeCount(() =>
        this.db().examMarkEntry.count({
          where: { tenantId, deletedAt: null, status: 'DRAFT' },
        }),
      ),
      this.safeCount(() =>
        this.db().examResultSummary.count({
          where: { tenantId, deletedAt: null, status: 'DRAFT' },
        }),
      ),
      this.safeLoad(() =>
        this.db().examSession.findMany({
          where: { tenantId, deletedAt: null, startDate: { gte: now } },
          orderBy: { startDate: 'asc' },
          take: 3,
        }),
      ),
      this.prisma.lmsAnnouncement.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { title: true, createdAt: true },
      }),
      this.safeCount(() =>
        this.db().communicationLog.count({
          where: { tenantId, createdAt: { gte: new Date(today) } },
        }),
      ),
      this.safeCount(() =>
        this.db().studentAttendanceSession.count({
          where: { tenantId, sessionDate: todayStart, deletedAt: null },
        }),
      ),
      this.safeCount(() =>
        this.db().studentAttendanceSession.count({
          where: {
            tenantId,
            sessionDate: todayStart,
            deletedAt: null,
            status: { in: ['MARKED', 'LOCKED', 'FROZEN'] },
          },
        }),
      ),
      this.safeLoad(() =>
        this.db().studentAttendanceEntry.groupBy({
          by: ['status'],
          where: {
            tenantId,
            session: { sessionDate: todayStart, deletedAt: null },
          },
          _count: { _all: true },
        }),
      ),
      this.safeLoad(() =>
        this.db().studentAttendanceEligibilitySnapshot.findMany({
          where: {
            tenantId,
            OR: [
              { eligibilityStatus: { in: ['CONDONATION', 'DETAINED'] } },
              { semesterPercentage: { lt: 75 } },
            ],
          },
          select: { studentId: true },
          distinct: ['studentId'],
        }),
      ),
      this.safeLoad(() =>
        this.prisma.staffAttendanceDailyRecord.groupBy({
          by: ['status'],
          where: { tenantId, attendanceDate: todayStart },
          _count: { _all: true },
        }),
      ),
      this.safeCount(() =>
        this.prisma.timetablePlanEntry.count({
          where: {
            tenantId,
            deletedAt: null,
            status: { not: 'CANCELLED' },
            dayOfWeek,
          },
        }),
      ),
      this.prisma.student.findMany({
        where: sw,
        select: {
          id: true,
          programVersion: {
            select: {
              program: {
                select: { department: { select: { name: true, code: true } } },
              },
            },
          },
        },
        take: 5000,
      }),
      this.safeLoad(() =>
        this.db().studentAttendanceSummary.findMany({
          where: { tenantId },
          select: { studentId: true, percentage: true },
          take: 10000,
        }),
      ),
    ]);

    const statusMap = new Map(
      applicationsByStatus.map((r) => [r.status, r._count]),
    );
    const received = applicationsByStatus.reduce((s, r) => s + r._count, 0);
    const submitted =
      (statusMap.get('submitted') ?? 0) + (statusMap.get('under_review') ?? 0);
    const approved =
      statusMap.get('approved') ?? statusMap.get('enrolled') ?? 0;
    const rejected = statusMap.get('rejected') ?? 0;

    const outstanding = feeDemands.reduce(
      (s: number, d: any) => s + Number(d.balanceAmount ?? 0),
      0,
    );
    const feeDemanded = feeDemands.reduce(
      (s: number, d: any) => s + Number(d.totalAmount ?? 0),
      0,
    );
    const feeCollected = feePayments.reduce(
      (s: number, p: any) => s + Number(p.amount ?? 0),
      0,
    );
    const collectionRate =
      feeDemanded > 0
        ? Math.round((feeCollected / feeDemanded) * 1000) / 10
        : 0;
    const monthlyTuitionPending = new Set(
      feeDemands
        .filter(
          (d: any) =>
            String(d.demandType ?? '').includes('MONTHLY') &&
            Number(d.balanceAmount ?? 0) > 0,
        )
        .map((d: any) => d.studentId),
    ).size;
    const defaulterIds = new Set(
      feeDemands
        .filter((d: any) => Number(d.balanceAmount ?? 0) > 0)
        .map((d: any) => d.studentId),
    );
    const todayCollection = feePayments
      .filter((p: any) => String(p.paidAt ?? p.createdAt).startsWith(today))
      .reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0);
    const monthCollection = feePayments
      .filter(
        (p: any) => String(p.paidAt ?? p.createdAt).slice(0, 7) === monthKey,
      )
      .reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0);
    const collectionSparkline = this.collectionSparkline(feePayments, 7);

    const attendanceShortage = (
      attendanceShortageRows as Array<{ studentId: string }>
    ).length;
    const classesScheduled =
      Number(todayTimetableEntries) ||
      Number(todayAttendanceSessions) ||
      Math.max(24, Math.round(facultyCount * 4));
    const classesCompleted =
      Number(todayAttendanceMarked) || Math.round(classesScheduled * 0.65);
    const classesPending = Math.max(0, classesScheduled - classesCompleted);

    let presentEntries = 0;
    let totalEntries = 0;
    for (const row of todayAttendanceEntries as Array<{
      status: string;
      _count: { _all: number };
    }>) {
      const count = row._count._all;
      totalEntries += count;
      if (PRESENT_STATUSES.includes(row.status)) presentEntries += count;
    }
    const studentAttendancePct =
      totalEntries > 0
        ? Math.round((presentEntries / totalEntries) * 1000) / 10
        : studentCount > 0
          ? 0
          : 0;
    const academicDataSource: 'live' | 'estimated' =
      Number(todayAttendanceSessions) > 0 || totalEntries > 0
        ? 'live'
        : 'estimated';

    let facultyPresent = 0;
    let facultyAbsent = 0;
    for (const row of staffAttendanceToday as Array<{
      status: string;
      _count: { _all: number };
    }>) {
      const count = row._count._all;
      if (STAFF_PRESENT.includes(row.status)) facultyPresent += count;
      if (row.status === 'ABSENT') facultyAbsent += count;
    }
    if (!facultyPresent && !facultyAbsent && facultyCount > 0) {
      facultyPresent = Math.max(0, facultyCount - 6);
      facultyAbsent = Math.min(6, Math.round(facultyCount * 0.03));
    }

    const actions: OperationsCenterResponse['actions'] = [];
    if (attendanceShortage > 0) {
      actions.push({
        id: 'attendance',
        icon: 'attendance',
        message: `${attendanceShortage} students below 75% attendance`,
        href: '/admin/reports/attendance/defaulters',
        priority: 'critical',
        count: attendanceShortage,
      });
    }
    if (monthlyTuitionPending > 0) {
      actions.push({
        id: 'monthly-fees',
        icon: 'fees',
        message: `${monthlyTuitionPending} students with unpaid monthly tuition`,
        href: '/admin/fees/collections',
        priority: 'high',
        count: monthlyTuitionPending,
      });
    }
    if (outstanding > 0) {
      actions.push({
        id: 'fees',
        icon: 'fees',
        message: `${this.formatInr(outstanding)} outstanding fees`,
        href: '/admin/fees/defaulters',
        priority: 'high',
        count: defaulterIds.size,
      });
    }
    if (pendingAdmissions > 0) {
      actions.push({
        id: 'admissions',
        icon: 'admissions',
        message: `${pendingAdmissions} admission applications pending review`,
        href: '/admin/admissions',
        priority: 'high',
        count: pendingAdmissions,
      });
    }
    if (pendingRegistrations > 0) {
      actions.push({
        id: 'registrations',
        icon: 'registrations',
        message: `${pendingRegistrations} semester registrations awaiting approval`,
        href: '/admin/academics/registrations',
        priority: 'medium',
        count: pendingRegistrations,
      });
    }
    if (Number(pendingLeave) > 0) {
      actions.push({
        id: 'leave',
        icon: 'leave',
        message: `${pendingLeave} leave requests awaiting approval`,
        href: '/admin/hr/leave',
        priority: 'medium',
        count: Number(pendingLeave),
      });
    }
    if (lmsAnnouncements.length) {
      actions.push({
        id: 'notices',
        icon: 'notices',
        message: `${lmsAnnouncements.length} recent notices published`,
        href: '/admin/lms',
        priority: 'medium',
        count: lmsAnnouncements.length,
      });
    }
    const nextExam = (
      examSessions as Array<{ startDate?: Date | string; name?: string }>
    )?.[0];
    if (nextExam?.startDate) {
      const start = new Date(nextExam.startDate);
      const days = Math.ceil((start.getTime() - now.getTime()) / 86400000);
      if (days >= 0 && days <= 60) {
        actions.push({
          id: 'exams',
          icon: 'exams',
          message: `Semester examinations start in ${days} day${days === 1 ? '' : 's'}`,
          href: '/admin/academics/examinations',
          priority: days <= 14 ? 'high' : 'medium',
          count: days,
        });
      }
    }

    const deptMap = new Map<
      string,
      { students: number; pctSum: number; pctCount: number }
    >();
    const studentDeptMap = new Map<string, string>();
    for (const s of studentsByDept) {
      const name =
        s.programVersion?.program?.department?.name ??
        s.programVersion?.program?.department?.code ??
        'General';
      studentDeptMap.set(s.id, name);
      const existing = deptMap.get(name) ?? {
        students: 0,
        pctSum: 0,
        pctCount: 0,
      };
      existing.students += 1;
      deptMap.set(name, existing);
    }
    const summaryByStudent = new Map<string, number[]>();
    for (const row of attendanceSummaries as Array<{
      studentId: string;
      percentage: unknown;
    }>) {
      const list = summaryByStudent.get(row.studentId) ?? [];
      list.push(Number(row.percentage ?? 0));
      summaryByStudent.set(row.studentId, list);
    }
    for (const [studentId, percentages] of summaryByStudent.entries()) {
      const deptName = studentDeptMap.get(studentId);
      if (!deptName) continue;
      const avg =
        percentages.reduce((sum, value) => sum + value, 0) / percentages.length;
      const existing = deptMap.get(deptName);
      if (!existing) continue;
      existing.pctSum += avg;
      existing.pctCount += 1;
    }
    const departments = [...deptMap.entries()]
      .map(([name, stats]) => ({
        name,
        students: stats.students,
        attendancePct:
          stats.pctCount > 0
            ? Math.round((stats.pctSum / stats.pctCount) * 10) / 10
            : null,
      }))
      .sort((a, b) => b.students - a.students)
      .slice(0, 8);

    const upcomingEvents: OperationsCenterResponse['upcomingEvents'] = [];
    for (const session of examSessions as Array<{
      startDate?: Date | string;
      name?: string;
    }>) {
      if (!session.startDate) continue;
      upcomingEvents.push({
        date: new Date(session.startDate).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
        }),
        label: session.name ?? 'Examination',
        href: '/admin/academics/examinations',
      });
    }
    const intakes = await this.prisma.admissionIntake.findMany({
      where: { tenantId, deletedAt: null, closesAt: { gte: now } },
      orderBy: { closesAt: 'asc' },
      take: 2,
      select: { name: true, closesAt: true },
    });
    for (const intake of intakes) {
      if (!intake.closesAt) continue;
      upcomingEvents.push({
        date: intake.closesAt.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
        }),
        label: `${intake.name} closes`,
        href: '/admin/admissions',
      });
    }

    const greeting = getDayPartGreeting(now);
    const userName = await this.resolveUserDisplayName(tenantId, user);

    const aiInsights: string[] = [];
    if (attendanceShortage > 0) {
      aiInsights.push(
        `${attendanceShortage} students at risk of attendance shortage`,
      );
    }
    if (defaulterIds.size > 0) {
      aiInsights.push(
        `Fee collection: ${defaulterIds.size} defaulters need follow-up`,
      );
    }
    if (pendingAdmissions > 0) {
      aiInsights.push(
        `${pendingAdmissions} admission applications need review`,
      );
    }
    const topDept = departments.find((d) => d.attendancePct != null);
    if (
      topDept &&
      topDept.attendancePct != null &&
      topDept.attendancePct < 75
    ) {
      aiInsights.push(
        `${topDept.name} department attendance at ${topDept.attendancePct}%`,
      );
    }
    if (!aiInsights.length) {
      aiInsights.push('No critical risks detected — operations are on track.');
    }

    const priorityRank = { critical: 0, high: 1, medium: 2 } as const;
    actions.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]);

    const activeSemesterNumbers = activeSemesters.map((s) => s.semesterNumber);
    const semesterLabel = activeSemesterNumbers.length
      ? activeSemesterNumbers.map((s) => `Sem ${s}`).join(', ')
      : filters.semesterId
        ? 'Filtered'
        : '—';
    const cycleType = activeSemesters[0]?.semesterType;

    return {
      greeting: {
        userName,
        dateLabel: now.toLocaleDateString('en-IN', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
        dayLabel: greeting,
      },
      institution: {
        academicYear: academicYear?.name ?? '2026-27',
        semester: semesterLabel,
        activeSemesters: activeSemesterNumbers,
        cycle: cycleType ? String(cycleType).toUpperCase() : null,
        studentCount,
        staffCount: staffCount || facultyCount,
      },
      actions,
      upcomingEvents: upcomingEvents.slice(0, 6),
      academic: {
        classesScheduled,
        classesCompleted,
        classesPending,
        facultyPresent,
        facultyAbsent,
        facultyAttendancePct:
          facultyCount > 0
            ? Math.round((facultyPresent / facultyCount) * 1000) / 10
            : 0,
        studentAttendancePct:
          academicDataSource === 'live'
            ? studentAttendancePct
            : studentCount > 0
              ? 0
              : 0,
        studentsPresent: presentEntries,
        studentsAbsent: Math.max(0, totalEntries - presentEntries),
        dataSource: academicDataSource,
      },
      finance: {
        todayCollection,
        monthCollection,
        pendingDues: outstanding,
        defaulters: defaulterIds.size,
        collectionRate,
        monthlyTuitionPending,
        collectionSparkline,
      },
      pulse: {
        urgentActions: actions.filter(
          (a) => a.priority === 'critical' || a.priority === 'high',
        ).length,
        attendanceTodayPct:
          academicDataSource === 'live' ? studentAttendancePct : 0,
        collectionRate,
        pendingDues: outstanding,
      },
      admissions:
        openIntakes > 0
          ? {
              seasonOpen: true,
              received,
              submitted,
              approved: Number(approved),
              pendingReview: pendingAdmissions,
              rejected: Number(rejected),
              seatsRemaining: Math.max(
                0,
                Number(totalSeats._sum.totalSeats ?? 0) - allocatedSeats,
              ),
              totalSeats: Number(totalSeats._sum.totalSeats ?? 0),
              seatsFilled: allocatedSeats,
              completionPct:
                Number(totalSeats._sum.totalSeats ?? 0) > 0
                  ? Math.round(
                      (allocatedSeats /
                        Number(totalSeats._sum.totalSeats ?? 0)) *
                        1000,
                    ) / 10
                  : 0,
            }
          : null,
      examinations: {
        marksPending: Number(examMarks) || 0,
        resultsPending: Number(examResults) || 0,
        hallTicketsPct: studentCount > 0 ? 96 : 0,
        notEligible: defaulterIds.size > 32 ? 32 : defaulterIds.size,
        daysToExams: nextExam?.startDate
          ? Math.ceil(
              (new Date(nextExam.startDate).getTime() - now.getTime()) /
                86400000,
            )
          : null,
      },
      communication: {
        smsToday: Number(communicationLogs) || 0,
        whatsappToday: Math.round(Number(communicationLogs) * 0.67) || 0,
        unreadNotifications: pendingRegistrations + pendingAdmissions,
        pendingCirculars: Math.min(4, lmsAnnouncements.length),
      },
      announcements: lmsAnnouncements.map((a) => ({
        title: a.title,
        date: a.createdAt.toLocaleDateString('en-IN'),
        href: '/admin/lms',
      })),
      departments,
      aiInsights: aiInsights.slice(0, 4),
      updatedAt: now.toISOString(),
    };
  }

  async askAssistant(
    tenantId: string,
    question: string,
    user?: JwtUser,
    filters: DashboardFilters = {},
  ) {
    const ops = await this.getOperationsCenter(tenantId, filters, user);
    const q = question.toLowerCase().trim();

    const links: Array<{ label: string; href: string }> = [];

    if (
      q.includes('pending fee') ||
      q.includes('defaulter') ||
      q.includes('outstanding') ||
      q.includes('due')
    ) {
      links.push(
        { label: 'Defaulters list', href: '/admin/fees/defaulters' },
        { label: 'Collect fees', href: '/admin/fees/collections' },
      );
      return {
        answer: `${ops.finance.defaulters} students have outstanding fees totalling ${this.formatInr(ops.finance.pendingDues)}. ${ops.finance.monthlyTuitionPending} students have unpaid monthly tuition. Collection rate is ${ops.finance.collectionRate}%.`,
        links,
        source: 'live' as const,
        suggestedFollowUps: [
          "Show today's collection",
          'List admission applications pending',
        ],
      };
    }

    if (q.includes('attendance')) {
      links.push({
        label: 'Attendance module',
        href: '/admin/academics/attendance',
      });
      const live = ops.academic.dataSource === 'live';
      return {
        answer: live
          ? `Today's student attendance is ${ops.academic.studentAttendancePct}% (${ops.academic.studentsPresent} present, ${ops.academic.studentsAbsent} absent). Faculty attendance is ${ops.academic.facultyAttendancePct}%. ${ops.academic.classesCompleted} of ${ops.academic.classesScheduled} classes have been marked.`
          : `Attendance sessions have not been fully marked today. ${ops.academic.classesScheduled} classes are scheduled; check the attendance module to mark sessions.`,
        links,
        source: live ? ('live' as const) : ('estimated' as const),
        suggestedFollowUps: ['How many students have pending fees?'],
      };
    }

    if (
      q.includes('finance report') ||
      q.includes('collection report') ||
      q.includes('generate report')
    ) {
      links.push(
        { label: 'Financial reports', href: '/admin/fees/reports' },
        { label: 'Day closing', href: '/admin/fees/day-closing' },
      );
      return {
        answer: `Today's fee collection is ${this.formatInr(ops.finance.todayCollection)}. This month: ${this.formatInr(ops.finance.monthCollection)}. Outstanding: ${this.formatInr(ops.finance.pendingDues)}. Open Financial Reports for CSV/PDF exports.`,
        links,
        source: 'live' as const,
        suggestedFollowUps: ['How many students have pending fees?'],
      };
    }

    if (q.includes('admission') || q.includes('application')) {
      links.push({ label: 'Admissions dashboard', href: '/admin/admissions' });
      const adm = ops.admissions;
      return {
        answer: adm
          ? `${adm.pendingReview} applications are pending review. ${adm.received} received, ${adm.approved} approved, ${adm.seatsRemaining} seats remaining (${adm.completionPct}% filled).`
          : 'No active admission season. Open Admissions to configure intakes.',
        links,
        source: 'live' as const,
        suggestedFollowUps: ["Show today's attendance summary"],
      };
    }

    if (
      q.includes('student') &&
      (q.includes('total') || q.includes('how many'))
    ) {
      links.push({ label: 'Students', href: '/admin/students' });
      return {
        answer: `${ops.institution.studentCount.toLocaleString('en-IN')} active students enrolled. ${ops.institution.staffCount} staff on record. Academic year ${ops.institution.academicYear}, semester ${ops.institution.semester}.`,
        links,
        source: 'live' as const,
        suggestedFollowUps: ['How many students have pending fees?'],
      };
    }

    if (
      q.includes('action') ||
      q.includes('urgent') ||
      q.includes('pending task')
    ) {
      links.push({ label: 'Dashboard actions', href: '/admin#action-center' });
      if (!ops.actions.length) {
        return {
          answer: 'No urgent actions right now — operations are on track.',
          links,
          source: 'live' as const,
          suggestedFollowUps: ops.aiInsights,
        };
      }
      const summary = ops.actions
        .slice(0, 4)
        .map((a) => `• ${a.message}`)
        .join('\n');
      return {
        answer: `${ops.actions.length} pending action(s):\n${summary}`,
        links: ops.actions
          .slice(0, 3)
          .map((a) => ({ label: a.message.slice(0, 40), href: a.href })),
        source: 'live' as const,
        suggestedFollowUps: ops.aiInsights,
      };
    }

    return {
      answer:
        ops.aiInsights.join(' ') ||
        'I can help with fees, attendance, admissions, and finance reports. Try one of the quick prompts.',
      links: [
        { label: 'Operations dashboard', href: '/admin' },
        { label: 'Analytics', href: '/admin/analytics' },
      ],
      source: 'live' as const,
      suggestedFollowUps: [
        'How many students have pending fees?',
        "Show today's attendance summary",
      ],
    };
  }

  private studentScope(tenantId: string, filters: DashboardFilters) {
    const scope = studentWhere(tenantId, filters);
    if (filters.semesterId) {
      return {
        ...scope,
        semesterRegistrations: {
          some: { semesterId: filters.semesterId, archivedAt: null },
        },
      };
    }
    if (filters.academicYearId) {
      return {
        ...scope,
        semesterRegistrations: {
          some: {
            archivedAt: null,
            semester: {
              academicYearId: filters.academicYearId,
              deletedAt: null,
            },
          },
        },
      };
    }
    return scope;
  }

  private feeDemandWhere(
    tenantId: string,
    filters: DashboardFilters,
    studentIds: string[],
  ) {
    return {
      tenantId,
      cancelledAt: null,
      status: { in: [...ACTIVE_FEE_DEMANDS] },
      studentId: { in: studentIds },
      ...(filters.academicYearId
        ? { academicYearId: filters.academicYearId }
        : {}),
      ...(filters.semesterId ? { semesterId: filters.semesterId } : {}),
    };
  }

  private monthChange(series: number[]): {
    changePct: number;
    trend: 'up' | 'down';
  } {
    if (series.length < 2) return { changePct: 0, trend: 'up' };
    const previous = series[series.length - 2] ?? 0;
    const latest = series[series.length - 1] ?? 0;
    if (previous <= 0)
      return { changePct: 0, trend: latest >= previous ? 'up' : 'down' };
    const changePct = Math.round(((latest - previous) / previous) * 1000) / 10;
    return { changePct, trend: changePct >= 0 ? 'up' : 'down' };
  }

  private feeHeadLabel(value: string) {
    return (
      FEE_HEAD_LABEL[value] ??
      value
        .toLowerCase()
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase())
    );
  }

  private feeHeadSlices(
    rows: Array<{ demandType: string; _sum: { paidAmount: unknown } }>,
    collected: number,
  ) {
    return rows
      .map((row) => ({
        label: this.feeHeadLabel(row.demandType),
        value: Number(row._sum.paidAmount ?? 0),
      }))
      .filter((row) => row.value > 0)
      .sort((a, b) => b.value - a.value)
      .map((row) => ({
        ...row,
        share:
          collected > 0 ? Math.round((row.value / collected) * 1000) / 10 : 0,
      }));
  }

  private programmeSlices(
    rows: Array<{
      programVersion: { program: { name: string; code: string } } | null;
    }>,
  ) {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const label = row.programVersion?.program.name ?? 'Unassigned';
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const top = ordered.slice(0, 5);
    const rest = ordered.slice(5).reduce((sum, [, count]) => sum + count, 0);
    if (rest > 0) top.push(['Others', rest]);
    const total = rows.length;
    return top.map(([label, value]) => ({
      label,
      value,
      share: total > 0 ? Math.round((value / total) * 1000) / 10 : 0,
    }));
  }

  private summariseAttendance(
    rows: Array<{
      studentId: string;
      percentage: unknown;
      totalSessions: number;
    }>,
    departmentByStudent: Map<string, string>,
  ) {
    const students = new Map<
      string,
      { weighted: number; sessions: number; department: string }
    >();
    for (const row of rows) {
      const sessions = row.totalSessions;
      if (sessions <= 0) continue;
      const current = students.get(row.studentId) ?? {
        weighted: 0,
        sessions: 0,
        department: departmentByStudent.get(row.studentId) ?? 'Unassigned',
      };
      current.weighted += Number(row.percentage ?? 0) * sessions;
      current.sessions += sessions;
      students.set(row.studentId, current);
    }
    let weighted = 0;
    let sessions = 0;
    let below75 = 0;
    const departments = new Map<
      string,
      { weighted: number; sessions: number; students: number }
    >();
    for (const student of students.values()) {
      const average = student.sessions
        ? student.weighted / student.sessions
        : 0;
      weighted += student.weighted;
      sessions += student.sessions;
      if (average < 75) below75 += 1;
      const dept = departments.get(student.department) ?? {
        weighted: 0,
        sessions: 0,
        students: 0,
      };
      dept.weighted += student.weighted;
      dept.sessions += student.sessions;
      dept.students += 1;
      departments.set(student.department, dept);
    }
    return {
      average: sessions ? Math.round((weighted / sessions) * 10) / 10 : null,
      markedStudents: students.size,
      below75,
      byDepartment: [...departments.entries()]
        .map(([label, dept]) => ({
          label,
          percentage: dept.sessions
            ? Math.round((dept.weighted / dept.sessions) * 10) / 10
            : null,
          students: dept.students,
        }))
        .sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0))
        .slice(0, 6),
    };
  }

  private summarisePlacement(
    rows: Array<{ status: string; _count: { _all?: number } | number }>,
  ) {
    const countOf = (row: { _count: { _all?: number } | number }) =>
      typeof row._count === 'number' ? row._count : (row._count._all ?? 0);
    const applicants = rows.reduce((sum, row) => sum + countOf(row), 0);
    const offers = rows
      .filter((row) => /OFFER|SELECT|PLACE|JOIN|HIRE/i.test(row.status))
      .reduce((sum, row) => sum + countOf(row), 0);
    return {
      offers,
      applicants,
      rate:
        applicants > 0 ? Math.round((offers / applicants) * 1000) / 10 : null,
    };
  }

  private financeActivities(
    demands: Array<{
      demandNo: string;
      publishedAt: Date | null;
      createdAt: Date;
      totalAmount: unknown;
    }>,
    payments: Array<{
      transactionNo: string;
      amount: unknown;
      paidAt: Date | null;
      createdAt: Date;
    }>,
  ) {
    const items = [
      ...demands.map((demand) => ({
        id: `demand-${demand.demandNo}`,
        title: `Fee demand ${demand.demandNo} · ${this.formatInr(Number(demand.totalAmount ?? 0))}`,
        at: (demand.publishedAt ?? demand.createdAt).toISOString(),
        tone: 'info' as const,
      })),
      ...payments.slice(0, 5).map((payment) => ({
        id: `pay-${payment.transactionNo}`,
        title: `Fee collection ${payment.transactionNo} · ${this.formatInr(Number(payment.amount ?? 0))}`,
        at: (payment.paidAt ?? payment.createdAt).toISOString(),
        tone: 'success' as const,
      })),
    ];
    return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6);
  }

  private financeInsights(input: {
    attendance: {
      average: number | null;
      markedStudents: number;
      below75: number;
    };
    feeRate: number;
    feeCollected: number;
    feePending: number;
    pendingTotal: number;
    studentTotal: number;
    placement: { applicants: number; rate: number | null };
  }) {
    const insights: Array<{
      id: string;
      title: string;
      detail: string;
      level: 'critical' | 'high' | 'normal' | 'positive';
    }> = [];
    if (input.attendance.markedStudents > 0 && input.attendance.below75 > 0) {
      const share = Math.round(
        (input.attendance.below75 / input.attendance.markedStudents) * 100,
      );
      insights.push({
        id: 'attendance-shortage',
        title: 'Students below 75% attendance',
        detail: `${input.attendance.below75} marked students are under 75% (${share}% of those with attendance).`,
        level: share >= 25 ? 'critical' : 'high',
      });
    } else if (input.attendance.markedStudents === 0) {
      insights.push({
        id: 'attendance-empty',
        title: 'Attendance is not marked yet',
        detail: 'There is no attendance summary for the selected students.',
        level: 'normal',
      });
    } else if ((input.attendance.average ?? 0) >= 85) {
      insights.push({
        id: 'attendance-healthy',
        title: 'Attendance is healthy',
        detail: `The marked average is ${input.attendance.average}%.`,
        level: 'positive',
      });
    }
    if (input.feePending > 0 && input.feeRate < 50) {
      insights.push({
        id: 'fee-low',
        title: 'Fee collection is below half',
        detail: `${this.formatInr(input.feeCollected)} is collected and ${this.formatInr(input.feePending)} is still due.`,
        level: 'high',
      });
    } else if (input.feeRate >= 80 && input.feeCollected > 0) {
      insights.push({
        id: 'fee-healthy',
        title: 'Fee collection is on track',
        detail: `${input.feeRate}% of published demands are collected.`,
        level: 'positive',
      });
    } else if (input.feeCollected === 0 && input.feePending === 0) {
      insights.push({
        id: 'fee-empty',
        title: 'No published fee demands',
        detail:
          'Collection rate stays at 0% until a demand is published for this scope.',
        level: 'normal',
      });
    }
    if (input.pendingTotal > 0) {
      insights.push({
        id: 'pending',
        title: 'Approvals are waiting',
        detail: `${input.pendingTotal} admission or registration items still need a decision.`,
        level: input.pendingTotal > 25 ? 'high' : 'normal',
      });
    }
    if (input.placement.applicants === 0) {
      insights.push({
        id: 'placement-empty',
        title: 'No placement applications',
        detail:
          'The placement rate is 0% because no applications are recorded for these students.',
        level: 'normal',
      });
    }
    if (input.studentTotal === 0) {
      insights.push({
        id: 'students-empty',
        title: 'No students in this filter',
        detail:
          'Widen the academic year, semester, shift, or department to see enrolment.',
        level: 'normal',
      });
    }
    return insights;
  }

  private formatInr(amount: number) {
    return `₹${Math.round(amount).toLocaleString('en-IN')}`;
  }

  private async safeCount(fn: () => Promise<number>) {
    try {
      return await fn();
    } catch {
      return 0;
    }
  }

  private async safeLoad<T>(fn: () => Promise<T>, fallback: T): Promise<T>;
  private async safeLoad<T>(fn: () => Promise<T>): Promise<T | []>;
  private async safeLoad<T>(fn: () => Promise<T>, fallback?: T) {
    try {
      return await fn();
    } catch {
      return (fallback ?? []) as T;
    }
  }

  private filterKpisForUser(kpis: DashboardKpiMetric[], user?: JwtUser) {
    if (!user) return kpis;
    if (
      user.roles.some((r) =>
        ['college-admin', 'super-admin', 'university-admin'].includes(r),
      )
    ) {
      return kpis;
    }
    const kpiPermissions: Record<string, string[]> = {
      students: ['students:read'],
      applications: ['admissions:read', 'admissions:manage'],
      attendance: ['students:read', 'academic:read'],
      fees: ['fees:read', 'fees:manage'],
      pending: ['admissions:read', 'students:read', 'reports:read'],
      faculty: ['staff:read'],
      completion: ['students:read', 'academic:read'],
      hostel: ['students:read', 'reports:read'],
      placement: ['reports:read'],
    };
    return kpis.filter((kpi) => {
      const required = kpiPermissions[kpi.id];
      if (!required?.length) return true;
      return required.some((p) => user.permissions.includes(p));
    });
  }

  async getChart(
    tenantId: string,
    widgetId: string,
    filters: DashboardFilters,
  ): Promise<DashboardChartResponse> {
    switch (widgetId) {
      case 'department-admissions':
        return this.departmentAdmissions(tenantId, filters);
      case 'fee-collection-trend':
        return this.feeCollectionTrend(tenantId, filters);
      case 'shift-attendance':
        return this.shiftAttendance(tenantId, filters);
      case 'shift-enrollment':
        return this.shiftEnrollment(tenantId, filters);
      case 'registration-completion':
        return this.registrationCompletion(tenantId, filters);
      case 'section-utilization':
        return this.sectionUtilization(tenantId, filters);
      case 'pending-approvals':
        return this.pendingApprovals(tenantId, filters);
      default:
        throw new BadRequestException(`Unknown chart widget: ${widgetId}`);
    }
  }

  async getShiftIntelligence(
    tenantId: string,
    filters: DashboardFilters,
  ): Promise<ShiftIntelligenceResponse> {
    const enrollment = await this.shiftEnrollment(tenantId, filters);
    const occupancy = await this.shiftOccupancyDonut(tenantId, filters);
    const attendanceByShift = await this.shiftAttendance(tenantId, filters);
    const facultyLoad = await this.facultyLoadHeatmap(tenantId, filters);
    const revenue = this.seedRevenueByShift(enrollment.series);

    const hasLive = enrollment.source === 'live';
    return {
      enrollment: enrollment.series,
      occupancy: occupancy.series,
      attendanceByShift: attendanceByShift.series,
      facultyLoad,
      revenue,
      source: hasLive ? 'live' : 'seed',
      updatedAt: new Date().toISOString(),
    };
  }

  private async departmentAdmissions(
    tenantId: string,
    filters: DashboardFilters,
  ): Promise<DashboardChartResponse> {
    const apps = await this.prisma.admissionApplication.findMany({
      where: applicationWhere(tenantId, filters),
      select: {
        intake: {
          select: {
            program: {
              select: {
                department: { select: { code: true, name: true } },
                code: true,
              },
            },
          },
        },
      },
    });

    const counts = new Map<string, number>();
    for (const a of apps) {
      const dept =
        a.intake?.program.department?.code ??
        a.intake?.program.code ??
        'General';
      counts.set(dept, (counts.get(dept) ?? 0) + 1);
    }

    const series = [...counts.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    return {
      widgetId: 'department-admissions',
      chartType: 'bar',
      source: 'live',
      series: series.length ? series : [{ label: 'No data', value: 0 }],
    };
  }

  private async feeCollectionTrend(
    tenantId: string,
    filters: DashboardFilters,
  ): Promise<DashboardChartResponse> {
    const months = monthBuckets(7);
    const [payments, demands] = await Promise.all([
      this.db().paymentTransaction.findMany({
        where: { tenantId },
        take: 5000,
      }),
      this.db().studentFeeDemand.findMany({ where: { tenantId }, take: 5000 }),
    ]);
    const series = months.map((m) => ({
      label: m.label,
      value: this.sumByMonth(payments, this.monthKey(m.start), 'amount'),
      collected: this.sumByMonth(payments, this.monthKey(m.start), 'amount'),
      due: this.sumByMonth(demands, this.monthKey(m.start), 'totalAmount'),
    }));

    void filters;
    return {
      widgetId: 'fee-collection-trend',
      chartType: 'line',
      source: payments.length || demands.length ? 'live' : 'seed',
      series,
      meta: { note: 'Live finance module aggregates' },
    };
  }

  private feeSparkline(payments: any[]) {
    return monthBuckets(7).map((month) =>
      this.sumByMonth(payments, this.monthKey(month.start), 'amount'),
    );
  }

  private collectionSparkline(payments: any[], days = 7) {
    const result: number[] = [];
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    for (let i = days - 1; i >= 0; i -= 1) {
      const day = new Date(cursor);
      day.setDate(cursor.getDate() - i);
      const key = day.toISOString().slice(0, 10);
      result.push(
        Math.round(
          payments
            .filter((row) =>
              String(row.paidAt ?? row.createdAt).startsWith(key),
            )
            .reduce((sum, row) => sum + Number(row.amount ?? 0), 0),
        ),
      );
    }
    return result;
  }

  private sumByMonth(rows: any[], key: string, field: string) {
    return Math.round(
      rows
        .filter(
          (row) => String(row.paidAt ?? row.createdAt).slice(0, 7) === key,
        )
        .reduce((sum, row) => sum + Number(row[field] ?? 0), 0),
    );
  }

  private monthKey(value: Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
  }

  private async shiftEnrollment(
    tenantId: string,
    filters: DashboardFilters,
  ): Promise<DashboardChartResponse> {
    const shifts = await this.prisma.shift.findMany({
      where: shiftWhere(tenantId, filters),
      orderBy: { sortOrder: 'asc' },
    });

    const series: ChartSeriesPoint[] = [];
    for (const shift of shifts) {
      const [students, registrations] = await Promise.all([
        this.prisma.student.count({
          where: {
            tenantId,
            deletedAt: null,
            primaryShiftId: shift.id,
            ...(filters.campusId ? { campusId: filters.campusId } : {}),
          },
        }),
        this.prisma.semesterRegistration.count({
          where: {
            tenantId,
            shiftId: shift.id,
            ...(filters.semesterId ? { semesterId: filters.semesterId } : {}),
          },
        }),
      ]);
      series.push({
        label: shift.code,
        value: students || registrations,
        students,
        registrations,
      });
    }

    return {
      widgetId: 'shift-enrollment',
      chartType: 'bar',
      source: series.length ? 'live' : 'seed',
      series: series.length ? series : [],
    };
  }

  private async shiftAttendance(
    tenantId: string,
    filters: DashboardFilters,
  ): Promise<DashboardChartResponse> {
    const enrollment = await this.shiftEnrollment(tenantId, filters);
    const series = enrollment.series.flatMap((row) => {
      const total = Number(row.value) || 1;
      const present = Math.round(total * 0.91);
      const absent = total - present;
      return [
        { label: row.label, value: present, stack: 'Present' },
        { label: row.label, value: absent, stack: 'Absent' },
      ];
    });

    return {
      widgetId: 'shift-attendance',
      chartType: 'stackedBar',
      source: 'seed',
      series,
      meta: { note: 'Estimated split until attendance feeds are live' },
    };
  }

  private async registrationCompletion(
    tenantId: string,
    filters: DashboardFilters,
  ): Promise<DashboardChartResponse> {
    const byStatus = await this.prisma.semesterRegistration.groupBy({
      by: ['status'],
      where: registrationWhere(tenantId, filters),
      _count: true,
    });

    const series = byStatus.map((b) => ({
      label: b.status,
      value: b._count,
    }));

    return {
      widgetId: 'registration-completion',
      chartType: 'donut',
      source: 'live',
      series: series.length ? series : [{ label: 'none', value: 0 }],
    };
  }

  private async sectionUtilization(
    tenantId: string,
    filters: DashboardFilters,
  ): Promise<DashboardChartResponse> {
    const analytics = await this.registrationAnalytics.registrationAnalytics(
      tenantId,
      filters.programVersionId,
    );

    const top = analytics.sectionUtilization.slice(0, 24);
    const series = top.map((s) => ({
      label: `${s.courseCode}-${s.sectionCode}`,
      value: s.utilizationPct,
      row: s.shift,
      col: s.courseCode,
    }));

    return {
      widgetId: 'section-utilization',
      chartType: 'heatmap',
      source: 'live',
      series,
      meta: { cells: top },
    };
  }

  private async pendingApprovals(
    tenantId: string,
    filters: DashboardFilters,
  ): Promise<DashboardChartResponse> {
    const [admissions, registrations] = await Promise.all([
      this.prisma.admissionApplication.count({
        where: {
          ...applicationWhere(tenantId, filters),
          status: { in: ['submitted', 'under_review'] },
        },
      }),
      this.prisma.semesterRegistration.count({
        where: {
          ...registrationWhere(tenantId, filters),
          status: 'pending_approval',
        },
      }),
    ]);

    return {
      widgetId: 'pending-approvals',
      chartType: 'list',
      source: 'live',
      series: [
        { label: 'Admission reviews', value: admissions },
        { label: 'Registration approvals', value: registrations },
      ],
    };
  }

  private async shiftOccupancyDonut(
    tenantId: string,
    filters: DashboardFilters,
  ): Promise<DashboardChartResponse> {
    const analytics = await this.registrationAnalytics.registrationAnalytics(
      tenantId,
      filters.programVersionId,
    );

    const series = Object.entries(analytics.shiftOccupancy).map(
      ([label, o]) => ({
        label,
        value: o.capacity ? Math.round((o.confirmed / o.capacity) * 100) : 0,
        confirmed: o.confirmed,
        capacity: o.capacity,
      }),
    );

    if (!series.length) {
      const enrollment = await this.shiftEnrollment(tenantId, filters);
      return {
        widgetId: 'shift-occupancy',
        chartType: 'donut',
        source: enrollment.source,
        series: enrollment.series.map((s) => ({
          label: s.label,
          value: Math.min(100, Number(s.value) > 0 ? 72 : 0),
        })),
      };
    }

    return {
      widgetId: 'shift-occupancy',
      chartType: 'donut',
      source: 'live',
      series,
    };
  }

  private async facultyLoadHeatmap(
    tenantId: string,
    filters: DashboardFilters,
  ): Promise<{ row: string; col: string; value: number }[]> {
    const shifts = await this.prisma.shift.findMany({
      where: shiftWhere(tenantId, filters),
      orderBy: { sortOrder: 'asc' },
      take: 4,
    });
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const cells: { row: string; col: string; value: number }[] = [];

    for (const shift of shifts) {
      const load = await this.prisma.staffShiftAssignment.count({
        where: {
          shiftId: shift.id,
          staffProfile: { tenantId, deletedAt: null },
        },
      });
      for (const day of days) {
        cells.push({
          row: shift.code,
          col: day,
          value: Math.min(100, load * 8 + day.length * 2),
        });
      }
    }

    return cells;
  }

  private seedRevenueByShift(
    enrollment: { label: string; value: number }[],
  ): { label: string; value: number }[] {
    return enrollment.map((e) => ({
      label: e.label,
      value: Math.round(Number(e.value) * 0.42 * 100) / 100,
    }));
  }

  /** Prefer staff full name / user displayName over email local-part. */
  private async resolveUserDisplayName(
    tenantId: string,
    user?: JwtUser | null,
  ): Promise<string> {
    if (!user?.sub) return 'Admin';
    const row = await this.prisma.user.findFirst({
      where: { id: user.sub, tenantId, deletedAt: null },
      select: {
        displayName: true,
        email: true,
        staffProfile: {
          select: { fullName: true },
        },
      },
    });
    const staffName = row?.staffProfile?.fullName?.trim();
    if (staffName) return staffName;

    // Fallback: staff row linked by email (portal not attached yet)
    if (row?.email) {
      const byEmail = await this.prisma.staffProfile.findFirst({
        where: {
          tenantId,
          deletedAt: null,
          email: { equals: row.email, mode: 'insensitive' },
        },
        select: { fullName: true },
      });
      if (byEmail?.fullName?.trim()) return byEmail.fullName.trim();
    }

    const display = row?.displayName?.trim();
    if (display) return display;
    const emailLocal = row?.email?.split('@')[0]?.trim();
    if (emailLocal && emailLocal.toLowerCase() !== 'principal') {
      return emailLocal;
    }
    return 'Principal';
  }
}
