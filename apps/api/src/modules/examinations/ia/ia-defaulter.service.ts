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
}
