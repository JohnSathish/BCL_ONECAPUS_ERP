import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class PrincipalFeeDefaulterService {
  constructor(private readonly prisma: PrismaService) {}

  async getMonitor(
    tenantId: string,
    filters: {
      departmentId?: string;
      semesterNo?: number;
      batchId?: string;
      shiftId?: string;
    } = {},
  ) {
    const summaries = await (this.prisma as any).studentFeeSummary.findMany({
      where: {
        tenantId,
        totalOutstanding: { gt: 0 },
      },
      take: 500,
    });

    const studentIds = summaries.map((s: { studentId: string }) => s.studentId);
    const students = studentIds.length
      ? await this.prisma.student.findMany({
          where: {
            tenantId,
            id: { in: studentIds },
            deletedAt: null,
            ...(filters.departmentId
              ? { departmentId: filters.departmentId }
              : {}),
            ...(filters.shiftId ? { primaryShiftId: filters.shiftId } : {}),
          },
          include: {
            masterProfile: { select: { fullName: true, mobileNumber: true } },
            department: { select: { name: true } },
            academicStanding: {
              select: { currentSemesterSequence: true },
            },
            programVersion: {
              include: { program: { select: { name: true } } },
            },
          },
        })
      : [];

    const studentMap = new Map(students.map((s) => [s.id, s]));

    let rows = summaries
      .map((s: Record<string, unknown>) => {
        const student = studentMap.get(s.studentId as string);
        if (!student) return null;
        const semester = student.academicStanding?.currentSemesterSequence;
        if (filters.semesterNo != null && semester !== filters.semesterNo) {
          return null;
        }
        return {
          studentId: student.id,
          enrollmentNumber: student.enrollmentNumber,
          fullName: student.masterProfile?.fullName,
          mobile: student.masterProfile?.mobileNumber,
          department: student.department?.name,
          programme: student.programVersion?.program?.name,
          semester,
          totalOutstanding: Number(s.totalOutstanding ?? 0),
          admissionOutstanding: Number(s.admissionOutstanding ?? 0),
          monthlyOutstanding: Number(s.monthlyOutstanding ?? 0),
          feeStatus: s.feeStatus,
        };
      })
      .filter(Boolean);

    const totalOutstanding = rows.reduce(
      (sum: number, r: { totalOutstanding: number }) =>
        sum + r.totalOutstanding,
      0,
    );
    const admissionPending = rows.filter(
      (r: { admissionOutstanding: number }) => r.admissionOutstanding > 0,
    ).length;
    const monthlyPending = rows.filter(
      (r: { monthlyOutstanding: number }) => r.monthlyOutstanding > 0,
    ).length;

    rows.sort(
      (a: { totalOutstanding: number }, b: { totalOutstanding: number }) =>
        b.totalOutstanding - a.totalOutstanding,
    );

    return {
      cards: {
        totalOutstanding,
        admissionFeePending: admissionPending,
        monthlyDuesPending: monthlyPending,
        studentCount: rows.length,
      },
      rows: rows.slice(0, 100),
    };
  }
}
