import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

export type SupportStudentContext = {
  studentId: string | null;
  userId: string;
  fullName: string;
  photoPath: string | null;
  enrollmentNumber: string | null;
  rollNumber: string | null;
  programme: string | null;
  semester: number | null;
  departmentName: string | null;
  mobile: string | null;
  email: string | null;
  attendancePercent: number | null;
  feeStatus: string | null;
  feeDueAmount: number | null;
  scholarshipStatus: string | null;
  academicAdvisor: string | null;
  links: {
    profile?: string;
    fees?: string;
    attendance?: string;
    documents?: string;
  };
};

@Injectable()
export class SupportStudentContextService {
  constructor(private readonly prisma: PrismaService) {}

  async forThread(
    tenantId: string,
    studentUserId: string,
  ): Promise<SupportStudentContext> {
    const student = await this.prisma.student.findFirst({
      where: { tenantId, userId: studentUserId, deletedAt: null },
      include: {
        masterProfile: {
          select: {
            fullName: true,
            photoPath: true,
            mobileNumber: true,
            email: true,
          },
        },
        department: { select: { name: true } },
        user: { select: { email: true, displayName: true } },
        academicProfile: {
          include: {
            admissionBatch: { select: { currentSemester: true } },
          },
        },
        academicStanding: {
          select: { currentSemesterSequence: true },
        },
        programVersion: {
          include: {
            program: { select: { name: true, code: true } },
          },
        },
      },
    });

    if (!student) {
      const user = await this.prisma.user.findFirst({
        where: { id: studentUserId, tenantId },
        select: { displayName: true, email: true },
      });
      return {
        studentId: null,
        userId: studentUserId,
        fullName: user?.displayName || user?.email || 'Student',
        photoPath: null,
        enrollmentNumber: null,
        rollNumber: null,
        programme: null,
        semester: null,
        departmentName: null,
        mobile: null,
        email: user?.email ?? null,
        attendancePercent: null,
        feeStatus: null,
        feeDueAmount: null,
        scholarshipStatus: null,
        academicAdvisor: null,
        links: {},
      };
    }

    const [fee, attendance] = await Promise.all([
      this.safeFee(tenantId, student.id),
      this.safeAttendance(tenantId, student.id),
    ]);

    const programme =
      student.programVersion?.program?.name ??
      student.programVersion?.program?.code ??
      null;

    const semester =
      student.academicStanding?.currentSemesterSequence ??
      student.academicProfile?.admissionBatch?.currentSemester ??
      null;

    return {
      studentId: student.id,
      userId: studentUserId,
      fullName:
        student.masterProfile?.fullName ||
        student.user.displayName ||
        'Student',
      photoPath: student.masterProfile?.photoPath ?? null,
      enrollmentNumber: student.enrollmentNumber,
      rollNumber: student.rollNumber,
      programme,
      semester,
      departmentName: student.department?.name ?? null,
      mobile: student.masterProfile?.mobileNumber ?? null,
      email: student.masterProfile?.email || student.user.email || null,
      attendancePercent: attendance,
      feeStatus: fee.status,
      feeDueAmount: fee.due,
      scholarshipStatus: fee.scholarship,
      academicAdvisor: null,
      links: {
        profile: `/admin/students/${student.id}`,
        fees: `/admin/fees/students/${student.id}`,
        attendance: `/admin/student-attendance?studentId=${student.id}`,
        documents: `/admin/students/${student.id}?tab=documents`,
      },
    };
  }

  async forChatThread(tenantId: string, threadId: string) {
    const thread = await (
      this.prisma as unknown as Record<string, any>
    ).supportChatThread.findFirst({
      where: { id: threadId, tenantId },
      select: { studentUserId: true },
    });
    if (!thread) throw new NotFoundException('Chat thread not found');
    return this.forThread(tenantId, thread.studentUserId as string);
  }

  private async safeFee(tenantId: string, studentId: string) {
    try {
      const demands = await this.prisma.studentFeeDemand.findMany({
        where: {
          tenantId,
          studentId,
          status: { in: ['OPEN', 'PARTIAL', 'OVERDUE', 'PUBLISHED', 'ISSUED'] },
          balanceAmount: { gt: 0 },
        },
        select: { status: true, balanceAmount: true, dueDate: true },
        take: 50,
      });
      const due = demands.reduce(
        (sum, d) => sum + Number(d.balanceAmount || 0),
        0,
      );
      const now = Date.now();
      const hasOverdue = demands.some(
        (d) =>
          d.status === 'OVERDUE' ||
          (d.dueDate &&
            new Date(d.dueDate).getTime() < now &&
            Number(d.balanceAmount) > 0),
      );
      const status = due <= 0 ? 'CLEAR' : hasOverdue ? 'OVERDUE' : 'DUE';

      let scholarship: string | null = null;
      try {
        const concessions = await this.prisma.feeConcession.findMany({
          where: {
            tenantId,
            studentId,
            status: { in: ['APPROVED', 'ACTIVE'] },
          },
          include: { scheme: { select: { name: true } } },
          take: 10,
        });
        const sch = concessions.find((c) =>
          /SCHOLAR|MERIT|MINORITY|SPORTS/i.test(
            `${c.concessionType ?? ''} ${(c as { scheme?: { name?: string } }).scheme?.name ?? ''}`,
          ),
        );
        if (sch) {
          scholarship =
            (sch as { scheme?: { name?: string } }).scheme?.name ||
            sch.concessionType ||
            'Active';
        } else if (concessions.length) {
          scholarship = 'Concession applied';
        }
      } catch {
        // optional
      }

      return { status, due, scholarship };
    } catch {
      return {
        status: null as string | null,
        due: null as number | null,
        scholarship: null as string | null,
      };
    }
  }

  private async safeAttendance(tenantId: string, studentId: string) {
    void tenantId;
    void studentId;
    // Attendance enrichment varies by deployment; panel links to attendance module.
    return null as number | null;
  }
}
