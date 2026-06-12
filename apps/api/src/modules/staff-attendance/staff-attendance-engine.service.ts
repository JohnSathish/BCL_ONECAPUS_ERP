import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AttendancePolicyEngineService } from './attendance-policy-engine.service';

type RawPunch = {
  id: string;
  tenantId: string;
  deviceId?: string | null;
  staffProfileId: string | null;
  deviceUserId: string;
  biometricId?: string | null;
  punchTimestamp: Date;
  punchDirection?: string | null;
};

const DEFAULT_MIN_WORK_MINUTES = 240;
const DEFAULT_FULL_DAY_MINUTES = 420;
const DEFAULT_OT_AFTER_MINUTES = 480;

@Injectable()
export class StaffAttendanceEngineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: AttendancePolicyEngineService,
  ) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  async processBatch(tenantId: string, batchId?: string) {
    const where: Record<string, unknown> = {
      tenantId,
      processingStatus: 'PENDING',
    };
    if (batchId) where.syncBatchId = batchId;

    const punches = (await this.db().staffAttendanceRawPunch.findMany({
      where,
      orderBy: { punchTimestamp: 'asc' },
      take: 20000,
    })) as RawPunch[];
    await this.backfillPunchStaffMappings(tenantId, punches);

    const byStaffDate = new Map<string, RawPunch[]>();
    for (const punch of punches) {
      if (!punch.staffProfileId) continue;
      const key = `${punch.staffProfileId}:${this.dateKey(punch.punchTimestamp)}`;
      byStaffDate.set(key, [...(byStaffDate.get(key) ?? []), punch]);
    }

    let processed = 0;
    for (const group of byStaffDate.values()) {
      await this.processStaffDate(tenantId, group);
      processed += group.length;
    }

    if (punches.length) {
      const processedIds = punches
        .filter((p) => p.staffProfileId)
        .map((p) => p.id);
      if (processedIds.length) {
        await this.db().staffAttendanceRawPunch.updateMany({
          where: { id: { in: processedIds } },
          data: { processingStatus: 'PROCESSED', processedAt: new Date() },
        });
      }
    }

    return { processedPunches: processed, records: byStaffDate.size };
  }

  private async backfillPunchStaffMappings(
    tenantId: string,
    punches: RawPunch[],
  ) {
    const unresolved = punches.filter((punch) => !punch.staffProfileId);
    if (!unresolved.length) return;

    const deviceUserIds = unresolved
      .map((punch) => punch.deviceUserId)
      .filter(Boolean);
    const biometricIds = unresolved
      .map((punch) => punch.biometricId)
      .filter(Boolean);
    const mappings = await this.db().staffBiometricMapping.findMany({
      where: {
        tenantId,
        active: true,
        OR: [
          { deviceUserId: { in: deviceUserIds } },
          { biometricId: { in: [...deviceUserIds, ...biometricIds] } },
        ],
      },
      select: {
        staffProfileId: true,
        deviceId: true,
        deviceUserId: true,
        biometricId: true,
      },
      take: 10000,
    });
    const byDevice = new Map<string, string>();
    const byBiometric = new Map<string, string>();
    for (const mapping of mappings) {
      if (!mapping.staffProfileId) continue;
      if (mapping.deviceId && mapping.deviceUserId)
        byDevice.set(
          `${mapping.deviceId}:${mapping.deviceUserId}`,
          mapping.staffProfileId,
        );
      if (mapping.deviceUserId)
        byBiometric.set(String(mapping.deviceUserId), mapping.staffProfileId);
      if (mapping.biometricId)
        byBiometric.set(String(mapping.biometricId), mapping.staffProfileId);
    }

    for (const punch of unresolved) {
      const staffProfileId =
        (punch.deviceId
          ? byDevice.get(`${punch.deviceId}:${punch.deviceUserId}`)
          : undefined) ??
        byBiometric.get(punch.deviceUserId) ??
        (punch.biometricId ? byBiometric.get(punch.biometricId) : undefined);
      if (!staffProfileId) continue;
      punch.staffProfileId = staffProfileId;
      await this.db().staffAttendanceRawPunch.update({
        where: { id: punch.id },
        data: { staffProfileId },
      });
    }
  }

  async recomputeRange(
    tenantId: string,
    from: Date,
    to: Date,
    staffProfileId?: string,
  ) {
    await this.db().staffAttendanceDailyRecord.deleteMany({
      where: {
        tenantId,
        staffProfileId: staffProfileId ? staffProfileId : undefined,
        attendanceDate: {
          gte: this.startOfDay(from),
          lte: this.startOfDay(to),
        },
      },
    });
    const fromDate = this.startOfDay(from);
    const toDate = this.endOfDay(to);
    const punches = (await this.db().staffAttendanceRawPunch.findMany({
      where: {
        tenantId,
        staffProfileId: staffProfileId ? staffProfileId : undefined,
        punchTimestamp: { gte: fromDate, lte: toDate },
      },
      orderBy: { punchTimestamp: 'asc' },
      take: 50000,
    })) as RawPunch[];
    await this.backfillPunchStaffMappings(tenantId, punches);

    const byStaffDate = new Map<string, RawPunch[]>();
    for (const punch of punches) {
      if (!punch.staffProfileId) continue;
      const key = `${punch.staffProfileId}:${this.dateKey(punch.punchTimestamp)}`;
      byStaffDate.set(key, [...(byStaffDate.get(key) ?? []), punch]);
    }

    for (const group of byStaffDate.values()) {
      await this.processStaffDate(tenantId, group);
    }
    const generatedAbsences = await this.generateExpectedRecords(
      tenantId,
      fromDate,
      toDate,
      staffProfileId,
    );

    return {
      processedPunches: punches.length,
      records: byStaffDate.size + generatedAbsences,
    };
  }

  private async processStaffDate(tenantId: string, punches: RawPunch[]) {
    if (!punches.length || !punches[0].staffProfileId) return;
    const policy = await this.policy.resolveForStaffDate(
      tenantId,
      punches[0].staffProfileId!,
      punches[0].punchTimestamp,
    );
    const duplicateTolerance = Number(
      policy.master?.duplicateSuppressionMin ?? 5,
    );
    const sorted = this.removeDuplicatePunches(
      [...punches].sort(
        (a, b) => a.punchTimestamp.getTime() - b.punchTimestamp.getTime(),
      ),
      duplicateTolerance,
    );
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    if (!first?.staffProfileId) return;

    const workedMinutes =
      last && first.id !== last.id
        ? Math.max(
            0,
            Math.round(
              (last.punchTimestamp.getTime() - first.punchTimestamp.getTime()) /
                60000,
            ),
          )
        : 0;
    const exceptionFlags: string[] = [];
    if (sorted.length === 1) exceptionFlags.push('MISSED_OUT');
    if (workedMinutes === 0) exceptionFlags.push('NO_OUT_PUNCH');
    if (sorted.length < punches.length)
      exceptionFlags.push('DUPLICATE_PUNCH_FILTERED');
    if (policy.holiday) exceptionFlags.push('HOLIDAY');
    if (policy.leave) exceptionFlags.push('ON_LEAVE');
    if (policy.dayRule && !policy.dayRule.workingDay)
      exceptionFlags.push('WEEKLY_OFF');
    if (!policy.dayRule) exceptionFlags.push('NO_SHIFT_ASSIGNED');

    const shiftStart = policy.dayRule
      ? this.dateAtTime(first.punchTimestamp, policy.dayRule.beginTime)
      : null;
    let shiftEnd = policy.dayRule
      ? this.dateAtTime(first.punchTimestamp, policy.dayRule.endTime)
      : null;
    if (
      shiftEnd &&
      shiftStart &&
      (policy.dayRule?.crossMidnight || shiftEnd <= shiftStart)
    ) {
      shiftEnd = new Date(shiftEnd.getTime() + 24 * 60 * 60 * 1000);
    }
    const lateMinutes = shiftStart
      ? Math.max(
          0,
          Math.round(
            (first.punchTimestamp.getTime() - shiftStart.getTime()) / 60000,
          ) - Number(policy.dayRule?.lateGraceMin ?? 0),
        )
      : 0;
    const earlyMinutes =
      shiftEnd && last?.id !== first.id
        ? Math.max(
            0,
            Math.round(
              (shiftEnd.getTime() - last.punchTimestamp.getTime()) / 60000,
            ) - Number(policy.dayRule?.earlyExitGraceMin ?? 0),
          )
        : 0;

    const halfDayThreshold = policy.dayRule?.halfDayAfter
      ? this.dateAtTime(first.punchTimestamp, policy.dayRule.halfDayAfter)
      : null;
    const absentThreshold = policy.dayRule?.absentAfter
      ? this.dateAtTime(first.punchTimestamp, policy.dayRule.absentAfter)
      : null;
    if (halfDayThreshold && first.punchTimestamp > halfDayThreshold)
      exceptionFlags.push('HALF_DAY_THRESHOLD');
    if (absentThreshold && first.punchTimestamp > absentThreshold)
      exceptionFlags.push('ABSENT_THRESHOLD');

    const status = this.resolveStatus(
      policy,
      sorted.length,
      workedMinutes,
      first.punchTimestamp,
      halfDayThreshold,
      absentThreshold,
    );
    const overtimeStart = policy.dayRule?.otStartAfter
      ? this.dateAtTime(first.punchTimestamp, policy.dayRule.otStartAfter)
      : null;
    const overtimeAfter = Number(
      policy.dayRule?.minOtThresholdMin ||
        policy.overtimeRule?.minThresholdMin ||
        DEFAULT_OT_AFTER_MINUTES,
    );
    const rawOvertime =
      overtimeStart && last?.id !== first.id
        ? Math.max(
            0,
            Math.round(
              (last.punchTimestamp.getTime() - overtimeStart.getTime()) / 60000,
            ),
          )
        : Math.max(0, workedMinutes - overtimeAfter);
    const overtimeMinutes =
      policy.dayRule?.otEligible || policy.overtimeRule?.eligible
        ? Math.min(
            rawOvertime,
            Number(policy.dayRule?.maxDailyOtMin || rawOvertime),
          )
        : 0;
    if (overtimeMinutes > 0) exceptionFlags.push('OVERTIME');
    if (lateMinutes > 0) exceptionFlags.push('LATE');
    if (earlyMinutes > 0) exceptionFlags.push('EARLY_OUT');
    if (sorted.length === 1) exceptionFlags.push('MISSING_OUT');
    const attendanceDate = new Date(this.dateKey(first.punchTimestamp));

    await this.db().staffAttendanceDailyRecord.upsert({
      where: {
        tenantId_staffProfileId_attendanceDate: {
          tenantId,
          staffProfileId: first.staffProfileId,
          attendanceDate,
        },
      },
      update: {
        firstInAt: first.punchTimestamp,
        lastOutAt: last?.id === first.id ? null : last?.punchTimestamp,
        workedMinutes,
        lateMinutes,
        earlyMinutes,
        overtimeMinutes,
        status,
        exceptionFlags,
        sourcePunchIds: sorted.map((p) => p.id),
        processedAt: new Date(),
        shiftId: policy.shiftRule?.shiftId ?? policy.assignment?.shiftRuleId,
        remarks: this.remarks(policy, exceptionFlags),
      },
      create: {
        tenantId,
        staffProfileId: first.staffProfileId,
        attendanceDate,
        firstInAt: first.punchTimestamp,
        lastOutAt: last?.id === first.id ? null : last?.punchTimestamp,
        workedMinutes,
        lateMinutes,
        earlyMinutes,
        overtimeMinutes,
        status,
        exceptionFlags,
        sourcePunchIds: sorted.map((p) => p.id),
        shiftId: policy.shiftRule?.shiftId ?? policy.assignment?.shiftRuleId,
        remarks: this.remarks(policy, exceptionFlags),
      },
    });
  }

  private async generateExpectedRecords(
    tenantId: string,
    from: Date,
    to: Date,
    staffProfileId?: string,
  ) {
    const staffRows = await this.db().staffProfile.findMany({
      where: { tenantId, deletedAt: null, id: staffProfileId },
      select: { id: true },
      take: 10000,
    });
    let generated = 0;
    for (const date of this.dateRange(from, to)) {
      for (const staff of staffRows) {
        const existing = await this.db().staffAttendanceDailyRecord.findUnique({
          where: {
            tenantId_staffProfileId_attendanceDate: {
              tenantId,
              staffProfileId: staff.id,
              attendanceDate: date,
            },
          },
        });
        if (existing) continue;
        const policy = await this.policy.resolveForStaffDate(
          tenantId,
          staff.id,
          date,
        );
        const status = policy.holiday
          ? 'HOLIDAY'
          : policy.leave
            ? 'ON_LEAVE'
            : policy.dayRule && !policy.dayRule.workingDay
              ? 'WEEKLY_OFF'
              : policy.dayRule
                ? 'ABSENT'
                : policy.master?.noShiftAssignedHandling === 'IGNORE_ATTENDANCE'
                  ? 'IGNORED'
                  : 'PENDING_REVIEW';
        if (status === 'IGNORED') continue;
        const exceptionFlags = [
          status === 'HOLIDAY' ? 'HOLIDAY' : null,
          status === 'ON_LEAVE' ? 'ON_LEAVE' : null,
          status === 'WEEKLY_OFF' ? 'WEEKLY_OFF' : null,
          status === 'ABSENT' ? 'NO_PUNCH' : null,
          !policy.dayRule ? 'NO_SHIFT_ASSIGNED' : null,
        ].filter(Boolean);
        await this.db().staffAttendanceDailyRecord.create({
          data: {
            tenantId,
            staffProfileId: staff.id,
            attendanceDate: date,
            shiftId:
              policy.shiftRule?.shiftId ?? policy.assignment?.shiftRuleId,
            workedMinutes: 0,
            lateMinutes: 0,
            earlyMinutes: 0,
            overtimeMinutes: 0,
            status,
            exceptionFlags,
            sourcePunchIds: [],
            remarks: this.remarks(policy, exceptionFlags),
          },
        });
        generated += 1;
      }
    }
    return generated;
  }

  private dateKey(value: Date) {
    return value.toISOString().slice(0, 10);
  }

  private startOfDay(value: Date) {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private endOfDay(value: Date) {
    const date = new Date(value);
    date.setHours(23, 59, 59, 999);
    return date;
  }

  private dateRange(from: Date, to: Date) {
    const dates: Date[] = [];
    const cursor = this.startOfDay(from);
    const end = this.startOfDay(to);
    while (cursor <= end) {
      dates.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
  }

  private removeDuplicatePunches(
    punches: RawPunch[],
    toleranceMinutes: number,
  ) {
    const result: RawPunch[] = [];
    for (const punch of punches) {
      const previous = result[result.length - 1];
      if (
        previous &&
        previous.staffProfileId === punch.staffProfileId &&
        Math.abs(
          punch.punchTimestamp.getTime() - previous.punchTimestamp.getTime(),
        ) <=
          toleranceMinutes * 60_000
      ) {
        continue;
      }
      result.push(punch);
    }
    return result;
  }

  private dateAtTime(base: Date, time: string) {
    const [hours = '0', minutes = '0'] = String(time).split(':');
    const date = new Date(base);
    date.setHours(Number(hours), Number(minutes), 0, 0);
    return date;
  }

  private resolveStatus(
    policy: any,
    punchCount: number,
    workedMinutes: number,
    firstPunch: Date,
    halfDayThreshold: Date | null,
    absentThreshold: Date | null,
  ) {
    if (policy.holiday) return 'HOLIDAY';
    if (policy.leave) return 'ON_LEAVE';
    if (policy.dayRule && !policy.dayRule.workingDay) return 'WEEKLY_OFF';
    if (!policy.dayRule) return 'PRESENT';
    if (absentThreshold && firstPunch > absentThreshold) return 'ABSENT';
    if (halfDayThreshold && firstPunch > halfDayThreshold) return 'HALF_DAY';
    if (punchCount === 1) return 'PRESENT';
    if (
      workedMinutes >=
      Number(policy.dayRule.fullDayMinutes ?? DEFAULT_FULL_DAY_MINUTES)
    )
      return 'PRESENT';
    if (
      workedMinutes >=
      Number(policy.dayRule.halfDayMinutes ?? DEFAULT_MIN_WORK_MINUTES)
    )
      return 'HALF_DAY';
    return workedMinutes > 0 ? 'HALF_DAY' : 'ABSENT';
  }

  private remarks(policy: any, exceptionFlags: unknown[]) {
    if (policy.holiday) return `Holiday: ${policy.holiday.name}`;
    if (policy.leave)
      return `Leave: ${policy.leave.leaveTypeCode ?? policy.leave.type ?? 'Approved leave'}`;
    if (exceptionFlags.includes('WEEKLY_OFF'))
      return 'Weekly off / non-working day';
    if (exceptionFlags.includes('NO_SHIFT_ASSIGNED'))
      return 'No shift assigned for this date';
    if (exceptionFlags.includes('MISSING_OUT'))
      return 'First punch received; OUT punch missing';
    return undefined;
  }
}
