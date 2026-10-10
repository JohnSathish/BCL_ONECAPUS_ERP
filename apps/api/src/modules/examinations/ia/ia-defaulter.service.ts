import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { IaSettingsService } from './ia-settings.service';

@Injectable()
export class IaDefaulterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: IaSettingsService,
  ) {}

  async list(tenantId: string) {
    const cfg = await this.settings.getOrCreate(tenantId);
    const minAttendance = Number(cfg.attendanceMinPercent);
    const passThreshold = Number(cfg.iaPassMarkPercent);

    const students = await this.prisma.student.findMany({
      where: { tenantId, deletedAt: null },
      select: {
        id: true,
        rollNumber: true,
        enrollmentNumber: true,
        user: { select: { displayName: true, email: true } },
      },
      take: 500,
    });

    const lowIa = await (this.prisma as any).iaConsolidationRow.findMany({
      where: {
        tenantId,
        percentage: { lt: passThreshold },
      },
      select: { studentId: true, percentage: true, resultStatus: true },
    });
    const lowIaMap = new Map<string, number>(
      lowIa.map((r: { studentId: string; percentage: unknown }) => [
        r.studentId,
        Number(r.percentage),
      ]),
    );

    const defaulters = students
      .map((s) => {
        const reasons: string[] = [];
        const iaPct = lowIaMap.get(s.id);
        if (iaPct != null && iaPct < passThreshold) {
          reasons.push(`IA below ${passThreshold}% (${iaPct.toFixed(1)}%)`);
        }
        return reasons.length
          ? {
              studentId: s.id,
              rollNumber: s.rollNumber,
              enrollmentNumber: s.enrollmentNumber,
              fullName: s.user?.displayName,
              email: s.user?.email,
              reasons,
              attendancePercent: null,
              iaPercent: iaPct ?? null,
              feeDue: false,
              libraryDue: false,
            }
          : null;
      })
      .filter((x): x is NonNullable<typeof x> => x != null);

    return {
      minAttendancePercent: minAttendance,
      iaPassMarkPercent: passThreshold,
      total: defaulters.length,
      items: defaulters,
    };
  }

  async report(
    tenantId: string,
    filters?: {
      sessionId?: string;
      departmentId?: string;
      programmeCode?: string;
      semesterNo?: number;
    },
  ) {
    const cfg = await this.settings.getOrCreate(tenantId);
    const minAttendance = Number(cfg.attendanceMinPercent);
    const passThreshold = Number(cfg.iaPassMarkPercent);
    const scopeIds = filters?.sessionId
      ? await this.studentIdsForSession(tenantId, filters.sessionId)
      : null;

    const [programmes, departments, semesterGroups] = await Promise.all([
      this.prisma.program.findMany({
        where: { tenantId, deletedAt: null },
        select: { code: true, name: true },
        orderBy: { name: 'asc' },
        take: 200,
      }),
      this.prisma.department.findMany({
        where: { tenantId, deletedAt: null, status: 'ACTIVE' },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
        take: 200,
      }),
      this.prisma.studentSemesterProgress.groupBy({
        by: ['semesterSequence'],
        where: { tenantId },
      }),
    ]);

    const empty = {
      minAttendancePercent: minAttendance,
      iaPassMarkPercent: passThreshold,
      totalStudents: 0,
      total: 0,
      attendanceDefaulters: 0,
      feeDefaulters: 0,
      libraryDefaulters: 0,
      academicDefaulters: 0,
      multipleIssues: 0,
      cleared: 0,
      programmes,
      departments,
      semesters: semesterGroups
        .map((row) => row.semesterSequence)
        .sort((a, b) => a - b),
      items: [] as DefaulterReportItem[],
    };
    if (scopeIds && scopeIds.length === 0) return empty;

    const scopeFilter = scopeIds ? { studentId: { in: scopeIds } } : {};
    const [
      lowIa,
      lowAttendance,
      fees,
      overdueLoans,
      unpaidFines,
      totalStudents,
    ] = await Promise.all([
      this.prisma.iaConsolidationRow.findMany({
        where: { tenantId, percentage: { lt: passThreshold }, ...scopeFilter },
        select: { studentId: true },
      }),
      this.prisma.studentAttendanceSummary.findMany({
        where: {
          tenantId,
          periodKey: 'SEMESTER',
          percentage: { lt: minAttendance },
          ...scopeFilter,
        },
        select: { studentId: true },
      }),
      this.prisma.studentFeeSummary.findMany({
        where: {
          tenantId,
          ...scopeFilter,
          OR: [
            { totalOutstanding: { gt: 0 } },
            { feeStatus: { in: ['HOLD', 'CRITICAL_HOLD'] } },
          ],
        },
        select: { studentId: true },
      }),
      this.prisma.libraryLoan.findMany({
        where: {
          tenantId,
          returnedAt: null,
          dueAt: { lt: new Date() },
          studentId: scopeIds ? { in: scopeIds } : { not: null },
        },
        select: { studentId: true },
      }),
      this.prisma.libraryFine.findMany({
        where: {
          tenantId,
          paidAt: null,
          waivedAt: null,
          loan: { studentId: scopeIds ? { in: scopeIds } : { not: null } },
        },
        select: { loan: { select: { studentId: true } } },
      }),
      this.prisma.student.count({
        where: this.studentWhere(tenantId, filters, scopeIds),
      }),
    ]);

    const candidateIds = [
      ...new Set([
        ...lowIa.map((row) => row.studentId),
        ...lowAttendance.map((row) => row.studentId),
        ...fees.map((row) => row.studentId),
        ...overdueLoans
          .map((row) => row.studentId)
          .filter((id): id is string => Boolean(id)),
        ...unpaidFines
          .map((row) => row.loan.studentId)
          .filter((id): id is string => Boolean(id)),
      ]),
    ];
    const scope = scopeIds ? new Set(scopeIds) : null;
    const scopedIds = scope
      ? candidateIds.filter((id) => scope.has(id))
      : candidateIds;

    if (!scopedIds.length) {
      return { ...empty, totalStudents, cleared: totalStudents };
    }

    const [students, iaRows, attendanceRows, feeRows, loanRows, fineRows] =
      await Promise.all([
        this.prisma.student.findMany({
          where: {
            ...this.studentWhere(tenantId, filters, null),
            id: { in: scopedIds },
          },
          select: {
            id: true,
            rollNumber: true,
            enrollmentNumber: true,
            departmentId: true,
            user: { select: { displayName: true, email: true } },
            department: { select: { name: true } },
            programVersion: {
              select: { program: { select: { name: true, code: true } } },
            },
            academicStanding: { select: { currentSemesterSequence: true } },
          },
        }),
        this.prisma.iaConsolidationRow.findMany({
          where: { tenantId, studentId: { in: scopedIds } },
          select: { studentId: true, percentage: true },
        }),
        this.prisma.studentAttendanceSummary.findMany({
          where: {
            tenantId,
            periodKey: 'SEMESTER',
            studentId: { in: scopedIds },
          },
          select: { studentId: true, percentage: true },
        }),
        this.prisma.studentFeeSummary.findMany({
          where: { tenantId, studentId: { in: scopedIds } },
          select: { studentId: true, totalOutstanding: true, feeStatus: true },
        }),
        this.prisma.libraryLoan.findMany({
          where: {
            tenantId,
            studentId: { in: scopedIds },
            returnedAt: null,
            dueAt: { lt: new Date() },
          },
          select: { studentId: true },
        }),
        this.prisma.libraryFine.findMany({
          where: {
            tenantId,
            paidAt: null,
            waivedAt: null,
            loan: { studentId: { in: scopedIds } },
          },
          select: { loan: { select: { studentId: true } } },
        }),
      ]);

    const iaPercent = this.minByStudent(
      iaRows.map((row) => ({
        id: row.studentId,
        value: Number(row.percentage),
      })),
    );
    const attendance = this.averageByStudent(
      attendanceRows.map((row) => ({
        id: row.studentId,
        value: Number(row.percentage),
      })),
    );
    const feeByStudent = new Map(
      feeRows.map((row) => [
        row.studentId,
        {
          due: Number(row.totalOutstanding ?? 0),
          status: (row.feeStatus ?? '').toUpperCase(),
        },
      ]),
    );
    const libraryCount = new Map<string, number>();
    for (const loan of loanRows) {
      if (!loan.studentId) continue;
      libraryCount.set(
        loan.studentId,
        (libraryCount.get(loan.studentId) ?? 0) + 1,
      );
    }
    for (const fine of fineRows) {
      const studentId = fine.loan.studentId;
      if (!studentId) continue;
      libraryCount.set(studentId, (libraryCount.get(studentId) ?? 0) + 1);
    }

    const items: DefaulterReportItem[] = [];
    for (const student of students) {
      const issues: DefaulterIssue[] = [];
      const reasons: string[] = [];
      const ia = iaPercent.get(student.id);
      if (ia != null && ia < passThreshold) {
        issues.push('academic');
        reasons.push(`IA below ${passThreshold}% (${ia.toFixed(1)}%)`);
      }
      const attendancePercent = attendance.get(student.id);
      if (attendancePercent != null && attendancePercent < minAttendance) {
        issues.push('attendance');
        reasons.push(
          `Attendance ${attendancePercent.toFixed(1)}% below ${minAttendance}%`,
        );
      }
      const fee = feeByStudent.get(student.id);
      const feePending =
        (fee?.due ?? 0) > 0 ||
        fee?.status === 'HOLD' ||
        fee?.status === 'CRITICAL_HOLD';
      if (feePending) {
        issues.push('fee');
        reasons.push(
          fee && fee.due > 0
            ? `Fee dues pending (₹${fee.due.toLocaleString('en-IN')})`
            : `Fee hold (${fee?.status ?? 'HOLD'})`,
        );
      }
      const libraryIssues = libraryCount.get(student.id) ?? 0;
      if (libraryIssues > 0) {
        issues.push('library');
        reasons.push(
          libraryIssues === 1
            ? 'Library overdue or unpaid fine'
            : `${libraryIssues} library overdue items or unpaid fines`,
        );
      }
      if (!issues.length) continue;
      items.push({
        studentId: student.id,
        rollNumber: student.rollNumber,
        enrollmentNumber: student.enrollmentNumber,
        fullName: student.user?.displayName ?? null,
        email: student.user?.email ?? null,
        programme: student.programVersion?.program?.name ?? null,
        programmeCode: student.programVersion?.program?.code ?? null,
        department: student.department?.name ?? null,
        departmentId: student.departmentId,
        semesterNo: student.academicStanding?.currentSemesterSequence ?? null,
        iaPercent: ia ?? null,
        attendancePercent: attendancePercent ?? null,
        feeStatus: feePending ? 'PENDING' : 'PAID',
        feeDue: fee?.due ?? 0,
        libraryStatus: libraryIssues > 0 ? 'PENDING' : 'CLEAR',
        libraryIssues,
        issues,
        reasons,
        totalIssues: issues.length,
      });
    }
    items.sort((a, b) =>
      String(a.rollNumber ?? '').localeCompare(
        String(b.rollNumber ?? ''),
        undefined,
        {
          numeric: true,
        },
      ),
    );

    return {
      minAttendancePercent: minAttendance,
      iaPassMarkPercent: passThreshold,
      totalStudents,
      total: items.length,
      attendanceDefaulters: items.filter((row) =>
        row.issues.includes('attendance'),
      ).length,
      feeDefaulters: items.filter((row) => row.issues.includes('fee')).length,
      libraryDefaulters: items.filter((row) => row.issues.includes('library'))
        .length,
      academicDefaulters: items.filter((row) => row.issues.includes('academic'))
        .length,
      multipleIssues: items.filter((row) => row.issues.length > 1).length,
      cleared: Math.max(totalStudents - items.length, 0),
      programmes,
      departments,
      semesters: semesterGroups
        .map((row) => row.semesterSequence)
        .sort((a, b) => a - b),
      items,
    };
  }

  private studentWhere(
    tenantId: string,
    filters:
      | {
          departmentId?: string;
          programmeCode?: string;
          semesterNo?: number;
        }
      | undefined,
    scopeIds: string[] | null,
  ) {
    return {
      tenantId,
      deletedAt: null as null,
      ...(scopeIds ? { id: { in: scopeIds } } : {}),
      ...(filters?.departmentId ? { departmentId: filters.departmentId } : {}),
      ...(filters?.programmeCode
        ? { programVersion: { program: { code: filters.programmeCode } } }
        : {}),
      ...(filters?.semesterNo != null
        ? { academicStanding: { currentSemesterSequence: filters.semesterNo } }
        : {}),
    };
  }

  private async studentIdsForSession(tenantId: string, sessionId: string) {
    const papers = await this.prisma.examPaperSchedule.findMany({
      where: { tenantId, sessionId, deletedAt: null },
      select: { offeringId: true, courseId: true },
    });
    const offeringIds = papers
      .map((paper) => paper.offeringId)
      .filter((id): id is string => Boolean(id));
    const courseIds = papers
      .map((paper) => paper.courseId)
      .filter((id): id is string => Boolean(id));
    if (!offeringIds.length && !courseIds.length) return [];
    const lines = await this.prisma.semesterRegistrationLine.findMany({
      where: {
        tenantId,
        status: { in: ['approved', 'confirmed', 'registered', 'pending'] },
        OR: [
          ...(offeringIds.length ? [{ offeringId: { in: offeringIds } }] : []),
          ...(courseIds.length
            ? [{ offering: { courseId: { in: courseIds } } }]
            : []),
        ],
      },
      select: { registration: { select: { studentId: true } } },
    });
    return [...new Set(lines.map((line) => line.registration.studentId))];
  }

  private minByStudent(rows: Array<{ id: string; value: number }>) {
    const map = new Map<string, number>();
    for (const row of rows) {
      const current = map.get(row.id);
      if (current == null || row.value < current) map.set(row.id, row.value);
    }
    return map;
  }

  private averageByStudent(rows: Array<{ id: string; value: number }>) {
    const totals = new Map<string, { sum: number; count: number }>();
    for (const row of rows) {
      const current = totals.get(row.id) ?? { sum: 0, count: 0 };
      current.sum += row.value;
      current.count += 1;
      totals.set(row.id, current);
    }
    return new Map(
      [...totals.entries()].map(([id, value]) => [
        id,
        Math.round((value.sum / value.count) * 10) / 10,
      ]),
    );
  }
}

type DefaulterIssue = 'academic' | 'attendance' | 'fee' | 'library';

type DefaulterReportItem = {
  studentId: string;
  rollNumber: string | null;
  enrollmentNumber: string | null;
  fullName: string | null;
  email: string | null;
  programme: string | null;
  programmeCode: string | null;
  department: string | null;
  departmentId: string | null;
  semesterNo: number | null;
  iaPercent: number | null;
  attendancePercent: number | null;
  feeStatus: 'PAID' | 'PENDING';
  feeDue: number;
  libraryStatus: 'CLEAR' | 'PENDING';
  libraryIssues: number;
  issues: DefaulterIssue[];
  reasons: string[];
  totalIssues: number;
};
