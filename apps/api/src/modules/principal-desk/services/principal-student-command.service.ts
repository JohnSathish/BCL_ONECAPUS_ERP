import { Injectable, NotFoundException } from '@nestjs/common';
import { toPublicUploadUrl } from '../../../common/uploads/public-upload-url';
import { PrismaService } from '../../../database/prisma.service';
import { StudentFeeAccountService } from '../../fees/services/student-fee-account.service';
import { LibraryMemberLookupService } from '../../library/services/library-member-lookup.service';
import { StudentAttendanceService } from '../../student-attendance/student-attendance.service';

function attendanceBand(
  pct: number | null,
): 'green' | 'orange' | 'red' | 'neutral' {
  if (pct == null) return 'neutral';
  if (pct >= 75) return 'green';
  if (pct >= 60) return 'orange';
  return 'red';
}

@Injectable()
export class PrincipalStudentCommandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lookup: LibraryMemberLookupService,
    private readonly feeAccount: StudentFeeAccountService,
    private readonly attendance: StudentAttendanceService,
  ) {}

  async resolve(tenantId: string, query: string) {
    const code = this.lookup.normalizeScanCode(query);
    if (!code) throw new NotFoundException('Search query required');

    let studentId: string;
    try {
      const profile = await this.lookup.lookup(tenantId, code);
      if (profile.memberType !== 'STUDENT' || !profile.studentId) {
        throw new NotFoundException('Student not found');
      }
      studentId = profile.studentId;
    } catch {
      const byName = await this.prisma.student.findFirst({
        where: {
          tenantId,
          deletedAt: null,
          masterProfile: {
            fullName: { contains: code, mode: 'insensitive' },
          },
        },
        select: { id: true },
      });
      if (!byName) throw new NotFoundException(`No student found for: ${code}`);
      studentId = byName.id;
    }

    return this.buildCommandCard(tenantId, studentId);
  }

  async buildCommandCard(tenantId: string, studentId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      student,
      feeAccount,
      attendanceRows,
      remarks,
      libraryStats,
      examSummary,
      timeline,
    ] = await Promise.all([
      this.prisma.student.findFirst({
        where: { tenantId, id: studentId, deletedAt: null },
        include: {
          masterProfile: true,
          department: { select: { name: true } },
          programVersion: {
            include: { program: { select: { name: true, code: true } } },
          },
          academicStanding: true,
          academicProfile: {
            include: {
              admissionBatch: {
                include: { entrySession: { select: { name: true } } },
              },
            },
          },
          abcAccount: { select: { abcId: true } },
          user: { select: { email: true } },
          semesterRegistrations: {
            where: { status: { in: ['completed', 'approved', 'registered'] } },
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              lines: {
                where: { category: 'MAJOR' },
                include: {
                  offering: {
                    include: {
                      course: { select: { title: true, code: true } },
                    },
                  },
                },
                take: 1,
              },
            },
          },
        },
      }),
      this.feeAccount.getAccount(tenantId, studentId),
      this.attendance.summaries(tenantId, { studentId }),
      this.prisma.studentRemark.findMany({
        where: {
          tenantId,
          studentId,
          remarkType: { in: ['WARNING', 'DISCIPLINARY', 'COUNSELLING'] },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.libraryStats(tenantId, studentId),
      this.examStats(tenantId, studentId),
      this.buildTimeline(tenantId, studentId),
    ]);

    if (!student) throw new NotFoundException('Student not found');

    const percentages = (attendanceRows as Array<{ percentage?: unknown }>).map(
      (r) => Number(r.percentage ?? 0),
    );
    const overallPct = percentages.length
      ? Math.round(percentages.reduce((s, v) => s + v, 0) / percentages.length)
      : null;

    const totalSessions = (
      attendanceRows as Array<{ totalSessions?: unknown }>
    ).reduce((s, r) => s + Number(r.totalSessions ?? 0), 0);
    const presentCount = (
      attendanceRows as Array<{
        presentCount?: unknown;
        dutyLeaveCount?: unknown;
      }>
    ).reduce(
      (s, r) => s + Number(r.presentCount ?? 0) + Number(r.dutyLeaveCount ?? 0),
      0,
    );

    const outstanding = Number(feeAccount.summary?.outstanding ?? 0);
    const attendanceOk = overallPct != null && overallPct >= 75;
    const feesOk = outstanding <= 0;
    const admitEligible = attendanceOk && feesOk;
    const ineligibleReasons: string[] = [];
    if (!attendanceOk) ineligibleReasons.push('Attendance Shortage');
    if (!feesOk) ineligibleReasons.push('Outstanding Fees');

    const majorLine = student.semesterRegistrations?.[0]?.lines?.[0];
    const majorSubject =
      majorLine?.offering?.course?.title ??
      majorLine?.offering?.course?.code ??
      null;

    const lifecycle = student.academicStanding?.lifecycleState ?? 'ACTIVE';
    const isHosteller =
      student.academicProfile?.residenceType === 'HOSTELLER' ||
      Boolean(student.academicProfile?.hostelBlock);

    return {
      studentId,
      basic: {
        photoUrl: toPublicUploadUrl(student.masterProfile?.photoPath),
        fullName: student.masterProfile?.fullName ?? student.enrollmentNumber,
        enrollmentNumber: student.enrollmentNumber,
        rollNumber: student.rollNumber,
        abcId: student.abcAccount?.abcId ?? null,
        rfidNumber: student.rfidNumber,
        mobile: student.masterProfile?.mobileNumber ?? null,
        email: student.user?.email ?? null,
      },
      academic: {
        programme:
          student.programVersion?.program?.name ??
          student.programVersion?.program?.code ??
          null,
        department: student.department?.name ?? null,
        semester: student.academicStanding?.currentSemesterSequence ?? null,
        batch:
          student.academicProfile?.admissionBatch?.entrySession?.name ?? null,
        majorSubject,
        status: lifecycle,
        statusLabel:
          lifecycle === 'ACTIVE'
            ? 'Active Student'
            : lifecycle.replace(/_/g, ' '),
      },
      attendance: {
        percentage: overallPct,
        band: attendanceBand(overallPct),
        classesAttended: presentCount,
        classesConducted: totalSessions,
        subjects: (attendanceRows as Array<Record<string, unknown>>).slice(
          0,
          8,
        ),
      },
      admitCard: {
        eligible: admitEligible,
        reasons: ineligibleReasons,
        attendancePercent: overallPct,
        outstandingAmount: outstanding,
      },
      fees: {
        admissionFeeStatus: feeAccount.admissionFeeStatus,
        monthlyFeeStatus: feeAccount.monthlyFeeStatus,
        monthlyTracker: feeAccount.monthlyTracker,
        outstandingAmount: outstanding,
        summary: feeAccount.summary,
      },
      library: libraryStats,
      examination: examSummary,
      disciplinary: remarks.map(
        (r: {
          id: string;
          remarkType: string;
          body: string;
          createdAt: Date;
        }) => ({
          id: r.id,
          type: r.remarkType,
          body: r.body,
          createdAt: r.createdAt,
        }),
      ),
      hostel: isHosteller
        ? {
            isHosteller: true,
            block: student.academicProfile?.hostelBlock ?? null,
            room: student.academicProfile?.hostelRoom ?? null,
            warden: null,
            attendancePercent: null,
          }
        : { isHosteller: false },
      timeline,
      scannedAt: new Date().toISOString(),
    };
  }

  private async libraryStats(tenantId: string, studentId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [issued, active, overdue, fineAgg] = await Promise.all([
      this.prisma.libraryLoan.count({ where: { tenantId, studentId } }),
      this.prisma.libraryLoan.count({
        where: { tenantId, studentId, status: 'ACTIVE' },
      }),
      this.prisma.libraryLoan.count({
        where: {
          tenantId,
          studentId,
          status: 'ACTIVE',
          dueAt: { lt: today },
        },
      }),
      this.prisma.libraryFine.aggregate({
        where: {
          tenantId,
          paidAt: null,
          waivedAt: null,
          loan: { studentId },
        },
        _sum: { amount: true },
      }),
    ]);

    return {
      booksIssued: issued,
      booksReturned: Math.max(0, issued - active),
      booksCurrentlyHeld: active,
      dueBooks: overdue,
      fineAmount: Number(fineAgg._sum.amount ?? 0),
    };
  }

  private async examStats(tenantId: string, studentId: string) {
    try {
      const [markEntries, backlogMarks, failSummaries] = await Promise.all([
        this.prisma.examMarkEntry.count({
          where: { tenantId, studentId, deletedAt: null },
        }),
        this.prisma.examMarkEntry.count({
          where: {
            tenantId,
            studentId,
            deletedAt: null,
            resultStatus: { in: ['FAIL', 'ABSENT', 'MALPRACTICE'] },
          },
        }),
        this.prisma.examResultSummary.count({
          where: {
            tenantId,
            studentId,
            deletedAt: null,
            resultStatus: 'FAIL',
          },
        }),
      ]);

      const backlogs = backlogMarks + failSummaries;

      return {
        internalMarksRecorded: markEntries,
        assignmentsPending: 0,
        examinationEligible: backlogs === 0,
        backlogs,
      };
    } catch {
      return {
        internalMarksRecorded: 0,
        assignmentsPending: 0,
        examinationEligible: true,
        backlogs: 0,
      };
    }
  }

  private async buildTimeline(tenantId: string, studentId: string) {
    const events: Array<{
      at: Date;
      label: string;
      category: string;
    }> = [];

    const [visits, payments, receipts] = await Promise.all([
      this.prisma.libraryVisit.findMany({
        where: { tenantId, studentId },
        orderBy: { entryAt: 'desc' },
        take: 3,
        select: { entryAt: true },
      }),
      this.prisma.paymentTransaction.findMany({
        where: { tenantId, studentId, status: { in: ['SUCCESS', 'PAID'] } },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: { createdAt: true, amount: true },
      }),
      this.prisma.feeReceipt.findMany({
        where: { tenantId, studentId },
        orderBy: { issuedAt: 'desc' },
        take: 3,
        select: { issuedAt: true, amount: true, receiptNo: true },
      }),
    ]);

    for (const v of visits) {
      events.push({
        at: v.entryAt,
        label: 'Library Entry',
        category: 'library',
      });
    }
    for (const p of payments) {
      events.push({
        at: p.createdAt,
        label: `Fee Payment Received (₹${Number(p.amount).toLocaleString()})`,
        category: 'fees',
      });
    }
    for (const r of receipts) {
      events.push({
        at: r.issuedAt,
        label: `Receipt ${r.receiptNo} — ₹${Number(r.amount).toLocaleString()}`,
        category: 'fees',
      });
    }

    events.sort((a, b) => b.at.getTime() - a.at.getTime());

    return events.slice(0, 10).map((e) => ({
      at: e.at.toISOString(),
      label: e.label,
      category: e.category,
      dayLabel: this.dayLabel(e.at),
    }));
  }

  private dayLabel(d: Date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const day = new Date(d);
    day.setHours(0, 0, 0, 0);
    const diff = Math.round((today.getTime() - day.getTime()) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }
}
