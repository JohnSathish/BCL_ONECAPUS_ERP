import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { ENROLLED_LINE_STATUSES } from '../constants/lms.constants';

@Injectable()
export class LmsAttendanceBridgeService {
  constructor(private readonly prisma: PrismaService) {}

  async getWorkspaceSummary(
    tenantId: string,
    workspaceId: string,
    studentId?: string | null,
  ) {
    const workspace = await this.prisma.lmsWorkspace.findFirst({
      where: { id: workspaceId, tenantId, deletedAt: null },
      include: { course: { select: { id: true, code: true } } },
    });
    if (!workspace) return null;

    if (studentId) {
      const summary = await this.prisma.studentAttendanceSummary.findFirst({
        where: {
          tenantId,
          studentId,
          courseId: workspace.courseId,
          ...(workspace.offeringSectionId
            ? { offeringSectionId: workspace.offeringSectionId }
            : {}),
        },
        orderBy: { updatedAt: 'desc' },
      });

      const eligibility =
        await this.prisma.studentAttendanceEligibilitySnapshot.findFirst({
          where: {
            tenantId,
            studentId,
            courseId: workspace.courseId,
          },
          orderBy: { snapshotAt: 'desc' },
        });

      return {
        scope: 'student',
        attendancePct: summary ? Number(summary.percentage) : null,
        presentCount: summary?.presentCount ?? 0,
        absentCount: summary?.absentCount ?? 0,
        totalSessions: summary?.totalSessions ?? 0,
        eligible: eligibility
          ? eligibility.eligibilityStatus === 'ELIGIBLE'
          : null,
        eligibilityRule: eligibility?.ruleApplied ?? null,
      };
    }

    const lines = workspace.offeringSectionId
      ? await this.prisma.semesterRegistrationLine.findMany({
          where: {
            tenantId,
            offeringSectionId: workspace.offeringSectionId,
            status: { in: ENROLLED_LINE_STATUSES },
          },
          select: { registration: { select: { studentId: true } } },
        })
      : await this.prisma.semesterRegistrationLine.findMany({
          where: {
            tenantId,
            offeringId: workspace.courseOfferingId,
            status: { in: ENROLLED_LINE_STATUSES },
          },
          select: { registration: { select: { studentId: true } } },
        });

    const studentIds = [...new Set(lines.map((l) => l.registration.studentId))];
    if (!studentIds.length) {
      return { scope: 'class', studentCount: 0, averageAttendancePct: null };
    }

    const summaries = await this.prisma.studentAttendanceSummary.findMany({
      where: {
        tenantId,
        studentId: { in: studentIds },
        courseId: workspace.courseId,
        ...(workspace.offeringSectionId
          ? { offeringSectionId: workspace.offeringSectionId }
          : {}),
      },
    });

    const pcts = summaries
      .map((s) => Number(s.percentage))
      .filter((n) => !Number.isNaN(n));
    const averageAttendancePct =
      pcts.length > 0
        ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length)
        : null;

    return {
      scope: 'class',
      studentCount: studentIds.length,
      averageAttendancePct,
      summariesCount: summaries.length,
    };
  }
}
