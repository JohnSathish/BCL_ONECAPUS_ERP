import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { IaDefaulterService } from './ia-defaulter.service';
import { IA_EXAM_TYPES } from './ia.constants';

@Injectable()
export class IaDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly defaulters: IaDefaulterService,
  ) {}

  async adminDashboard(tenantId: string) {
    const [
      sessions,
      papers,
      marks,
      marksCompleted,
      sheets,
      students,
      pendingMarks,
      admitCardsGenerated,
      expectedRegistrations,
      defaulterSummary,
    ] = await Promise.all([
      (this.prisma as any).examSession.count({
        where: {
          tenantId,
          deletedAt: null,
          examType: { in: [...IA_EXAM_TYPES] },
        },
      }),
      (this.prisma as any).examPaperSchedule.count({
        where: { tenantId, deletedAt: null },
      }),
      (this.prisma as any).iaComponentMark.count({
        where: { tenantId, deletedAt: null },
      }),
      (this.prisma as any).iaComponentMark.count({
        where: { tenantId, deletedAt: null, marks: { not: null } },
      }),
      (this.prisma as any).iaConsolidationSheet.count({
        where: { tenantId, deletedAt: null },
      }),
      this.prisma.student.count({
        where: { tenantId, deletedAt: null },
      }),
      (this.prisma as any).iaComponentMark.count({
        where: { tenantId, deletedAt: null, marks: null, isAbsent: false },
      }),
      (this.prisma as any).iaAdmitCardIssue.count({
        where: { tenantId, deletedAt: null },
      }),
      (this.prisma as any).examPaperSchedule.aggregate({
        where: { tenantId, deletedAt: null },
        _sum: { expectedCount: true },
      }),
      this.defaulters.list(tenantId),
    ]);

    const registeredStudents = expectedRegistrations._sum?.expectedCount ?? 0;
    const defaulters = defaulterSummary.total;

    const workflowPending = await (
      this.prisma as any
    ).iaConsolidationSheet.groupBy({
      by: ['status'],
      where: { tenantId, deletedAt: null },
      _count: true,
    });

    const departments = await this.prisma.department.findMany({
      where: { tenantId, deletedAt: null, status: 'ACTIVE' },
      select: { id: true, name: true, code: true },
      take: 20,
    });

    return {
      summary: {
        totalStudents: students,
        registeredStudents,
        eligibleStudents: Math.max(registeredStudents - defaulters, 0),
        defaulters,
        iaSessions: sessions,
        scheduledPapers: papers,
        markEntries: marks,
        marksCompleted,
        consolidationSheets: sheets,
        pendingMarkEntry: pendingMarks,
        admitCardsGenerated,
        studentsAppeared: marksCompleted,
        studentsAbsent: await (this.prisma as any).iaComponentMark.count({
          where: { tenantId, deletedAt: null, isAbsent: true },
        }),
      },
      workflow: workflowPending.map(
        (w: { status: string; _count: number }) => ({
          status: w.status,
          count: w._count,
        }),
      ),
      departments: departments.map((d) => ({
        id: d.id,
        name: d.name,
        code: d.code,
        pendingSheets: 0,
      })),
      semesters: [1, 3, 5].map((sem) => ({
        semesterNo: sem,
        sessions: 0,
        pendingMarks: 0,
      })),
    };
  }

  async principalDashboard(tenantId: string) {
    const admin = await this.adminDashboard(tenantId);
    const lowPerformance = await (
      this.prisma as any
    ).iaConsolidationRow.findMany({
      where: { tenantId, resultStatus: 'FAIL' },
      take: 20,
      orderBy: { percentage: 'asc' },
    });

    const pendingApprovals = await (this.prisma as any).iaApprovalStep.count({
      where: { tenantId, status: 'PENDING' },
    });

    const facultyPending = await (this.prisma as any).iaComponentMark.count({
      where: { tenantId, deletedAt: null, marks: null, status: 'DRAFT' },
    });

    const topPerformers = await (
      this.prisma as any
    ).iaConsolidationRow.findMany({
      where: { tenantId, resultStatus: 'PASS' },
      orderBy: { percentage: 'desc' },
      take: 10,
    });

    const admitIssues = await (this.prisma as any).iaAdmitCardIssue.findMany({
      where: { tenantId, deletedAt: null },
      select: {
        downloadCount: true,
        printCount: true,
        eligibilitySnapshot: true,
      },
    });
    const admitGenerated = admitIssues.length;
    const admitDownloaded = admitIssues.filter(
      (i: { downloadCount: number }) => i.downloadCount > 0,
    ).length;
    const ineligibleCount = admitIssues.filter(
      (i: { eligibilitySnapshot: unknown }) => {
        const snap = i.eligibilitySnapshot as { eligible?: boolean } | null;
        return snap && snap.eligible === false;
      },
    ).length;

    return {
      ...admin.summary,
      departmentsWithLowPerformance: lowPerformance.length,
      pendingMarkEntry: admin.summary.pendingMarkEntry,
      attendanceDefaulters: 0,
      highFailureSubjects: lowPerformance.length,
      facultyPendingEvaluation: facultyPending,
      pendingApprovals,
      admitCardsGenerated: admitGenerated,
      admitCardsDownloaded: admitDownloaded,
      admitIneligible: ineligibleCount,
      topPerformers: topPerformers.map(
        (r: {
          studentId: string;
          percentage: unknown;
          totalMarks: unknown;
        }) => ({
          studentId: r.studentId,
          percentage: Number(r.percentage),
          totalMarks: Number(r.totalMarks),
        }),
      ),
    };
  }
}
