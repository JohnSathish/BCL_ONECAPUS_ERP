import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export type AttendanceMode = 'FIRST_LAST' | 'EVERY_PERIOD';

export type TenantAttendancePolicyRow = {
  id: string;
  tenantId: string;
  attendanceMode: AttendanceMode;
  shortageThresholdPct: number;
  defaulterThresholdPct: number;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class AttendancePolicyService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  async getOrCreate(tenantId: string): Promise<TenantAttendancePolicyRow> {
    const existing = await this.db().tenantAttendancePolicy.findUnique({
      where: { tenantId },
    });
    if (existing) {
      return this.normalize(existing);
    }
    const created = await this.db().tenantAttendancePolicy.create({
      data: {
        tenantId,
        attendanceMode: 'FIRST_LAST',
        shortageThresholdPct: 75,
        defaulterThresholdPct: 60,
      },
    });
    return this.normalize(created);
  }

  async update(
    tenantId: string,
    input: {
      attendanceMode?: AttendanceMode;
      shortageThresholdPct?: number;
      defaulterThresholdPct?: number;
      metadata?: Record<string, unknown>;
    },
  ) {
    await this.getOrCreate(tenantId);
    const updated = await this.db().tenantAttendancePolicy.update({
      where: { tenantId },
      data: {
        ...(input.attendanceMode
          ? { attendanceMode: input.attendanceMode }
          : {}),
        ...(input.shortageThresholdPct != null
          ? { shortageThresholdPct: input.shortageThresholdPct }
          : {}),
        ...(input.defaulterThresholdPct != null
          ? { defaulterThresholdPct: input.defaulterThresholdPct }
          : {}),
        ...(input.metadata ? { metadata: input.metadata } : {}),
      },
    });
    return this.normalize(updated);
  }

  /**
   * Under FIRST_LAST, only the first and last teaching periods of the day
   * (for that shift's timetable) count toward % and are offered for marking.
   * Breaks (periodNo 0) are never counted.
   */
  isPeriodCountable(
    mode: AttendanceMode,
    periodNo: number | null | undefined,
    teachingPeriodNos: number[],
  ) {
    if (periodNo == null || periodNo <= 0) return false;
    if (mode === 'EVERY_PERIOD') return true;
    const sorted = [...new Set(teachingPeriodNos.filter((n) => n > 0))].sort(
      (a, b) => a - b,
    );
    if (!sorted.length) return false;
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    return periodNo === first || periodNo === last;
  }

  private normalize(row: any): TenantAttendancePolicyRow {
    return {
      id: row.id,
      tenantId: row.tenantId,
      attendanceMode:
        row.attendanceMode === 'EVERY_PERIOD' ? 'EVERY_PERIOD' : 'FIRST_LAST',
      shortageThresholdPct: Number(row.shortageThresholdPct ?? 75),
      defaulterThresholdPct: Number(row.defaulterThresholdPct ?? 60),
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
    };
  }
}
