import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class PayrollAttendanceBridgeService {
  constructor(private readonly prisma: PrismaService) {}

  async getProrationFactor(
    tenantId: string,
    staffProfileId: string,
    month: number,
    year: number,
  ): Promise<{
    workingDays: number;
    lopDays: number;
    prorationFactor: number;
  }> {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    const calendarDays = end.getDate();

    const records = await this.prisma.staffAttendanceDailyRecord.findMany({
      where: {
        tenantId,
        staffProfileId,
        attendanceDate: { gte: start, lte: end },
      },
    });

    const lopDays = records.filter(
      (r) => r.status === 'LOP' || r.status === 'ABSENT',
    ).length;
    const presentDays = records.filter((r) =>
      ['PRESENT', 'HALF_DAY', 'LATE', 'ON_DUTY'].includes(r.status),
    ).length;
    const workingDays = presentDays > 0 ? presentDays : calendarDays - lopDays;
    const prorationFactor = calendarDays > 0 ? workingDays / calendarDays : 1;

    return {
      workingDays: workingDays || calendarDays,
      lopDays,
      prorationFactor: Math.min(1, Math.max(0, prorationFactor)),
    };
  }
}
