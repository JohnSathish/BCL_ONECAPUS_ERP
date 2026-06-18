import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class PrincipalAttendanceControlService {
  constructor(private readonly prisma: PrismaService) {}

  async getControlCenter(tenantId: string) {
    const PRESENT = ['P', 'L', 'OD', 'SPORTS', 'NSS', 'NCC'];
    const STAFF_PRESENT = ['PRESENT', 'LATE', 'HALF_DAY', 'ON_DUTY'];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      studentEntries,
      staffToday,
      deptSummaries,
      semesterSummaries,
      shortageRows,
    ] = await Promise.all([
      (this.prisma as any).studentAttendanceEntry.groupBy({
        by: ['status'],
        where: {
          tenantId,
          session: { sessionDate: today, deletedAt: null },
        },
        _count: true,
      }),
      this.prisma.staffAttendanceDailyRecord.groupBy({
        by: ['status'],
        where: { tenantId, attendanceDate: today },
        _count: true,
      }),
      (this.prisma as any).studentAttendanceSummary.groupBy({
        by: ['departmentId'],
        where: { tenantId, periodKey: 'SEMESTER' },
        _avg: { percentage: true },
        _count: true,
      }),
      (this.prisma as any).studentAttendanceSummary.groupBy({
        by: ['semesterNo'],
        where: { tenantId, periodKey: 'SEMESTER' },
        _avg: { percentage: true },
        _count: true,
      }),
      (this.prisma as any).studentAttendanceSummary.findMany({
        where: { tenantId, periodKey: 'SEMESTER', percentage: { lt: 75 } },
        orderBy: { percentage: 'asc' },
        take: 25,
      }),
    ]);

    let studentsPresent = 0;
    let studentsAbsent = 0;
    for (const row of studentEntries as Array<{
      status: string;
      _count: number;
    }>) {
      if (PRESENT.includes(row.status)) studentsPresent += row._count;
      if (row.status === 'A') studentsAbsent += row._count;
    }

    let staffPresent = 0;
    let staffAbsent = 0;
    for (const row of staffToday as Array<{ status: string; _count: number }>) {
      if (STAFF_PRESENT.includes(row.status)) staffPresent += row._count;
      if (row.status === 'ABSENT') staffAbsent += row._count;
    }

    const studentTotal = studentsPresent + studentsAbsent;
    const staffTotal = staffPresent + staffAbsent;

    return {
      overall: {
        studentAttendancePct: studentTotal
          ? Math.round((studentsPresent / studentTotal) * 1000) / 10
          : 0,
        staffAttendancePct: staffTotal
          ? Math.round((staffPresent / staffTotal) * 1000) / 10
          : 0,
        studentsPresent,
        studentsAbsent,
        staffPresent,
        staffAbsent,
      },
      departmentWise: deptSummaries,
      semesterWise: semesterSummaries,
      topShortage: shortageRows,
    };
  }
}
