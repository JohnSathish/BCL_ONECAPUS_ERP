import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

type EffectivePolicy = {
  master: Record<string, any>;
  shiftRule: Record<string, any> | null;
  dayRule: EffectiveDayRule | null;
  assignment: Record<string, any> | null;
  departmentRule: Record<string, any> | null;
  overtimeRule: Record<string, any> | null;
  holiday: Record<string, any> | null;
  calendar: Record<string, any> | null;
  leave: Record<string, any> | null;
};

export type EffectiveDayRule = {
  dayName: string;
  workingDay: boolean;
  beginTime: string;
  endTime: string;
  lateGraceMin: number;
  earlyExitGraceMin: number;
  halfDayAfter?: string | null;
  absentAfter?: string | null;
  minWorkMinutes: number;
  halfDayMinutes: number;
  fullDayMinutes: number;
  otEligible: boolean;
  otStartAfter?: string | null;
  minOtThresholdMin: number;
  maxDailyOtMin: number;
  crossMidnight: boolean;
  source: string;
};

@Injectable()
export class AttendancePolicyEngineService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  async resolveForStaffDate(
    tenantId: string,
    staffProfileId: string,
    date: Date,
  ): Promise<EffectivePolicy> {
    const staff = await this.db().staffProfile.findFirst({
      where: { id: staffProfileId, tenantId, deletedAt: null },
      select: {
        id: true,
        departmentId: true,
        designationId: true,
        staffType: true,
        primaryShiftId: true,
        primaryShift: {
          select: {
            id: true,
            name: true,
            code: true,
            startTime: true,
            endTime: true,
          },
        },
      },
    });
    const master = await this.getMasterSettings(tenantId);
    const dateOnly = this.dateOnly(date);

    const assignment = await this.resolveAssignment(tenantId, staff, dateOnly);
    const departmentRule = staff?.departmentId
      ? await this.db().staffDepartmentAttendanceRule.findFirst({
          where: { tenantId, departmentId: staff.departmentId, active: true },
          orderBy: { updatedAt: 'desc' },
        })
      : null;
    const calendar = await this.resolveCalendar(
      tenantId,
      staff?.departmentId,
      dateOnly,
    );
    const shiftRule = await this.resolveShiftRule(
      tenantId,
      assignment,
      departmentRule,
      staff,
      calendar,
    );
    const overtimeRule = await this.resolveOvertimeRule(
      tenantId,
      shiftRule,
      departmentRule,
    );
    const holiday = await this.resolveHoliday(
      tenantId,
      staff?.departmentId,
      dateOnly,
    );
    const leave = await this.resolveLeave(tenantId, staff?.id, dateOnly);
    const dayRule = this.resolveDayRule(master, shiftRule, calendar, dateOnly);

    return {
      master,
      shiftRule,
      dayRule,
      assignment,
      departmentRule,
      overtimeRule,
      holiday,
      calendar,
      leave,
    };
  }

  async getMasterSettings(tenantId: string) {
    const existing = await this.db().staffAttendanceMasterSetting.findUnique({
      where: { tenantId },
    });
    if (existing) return existing;
    return this.db().staffAttendanceMasterSetting.create({
      data: {
        tenantId,
        timezone: 'Asia/Kolkata',
        deviceIdentityStrategy: 'BIOMETRIC_ID',
        duplicateSuppressionMin: 5,
        minPunchDifferenceMin: 5,
      },
    });
  }

  private async resolveAssignment(tenantId: string, staff: any, date: Date) {
    const scopeOr: Array<Record<string, unknown>> = [{ scopeType: 'DEFAULT' }];
    if (staff?.id) scopeOr.push({ staffProfileId: staff.id });
    if (staff?.departmentId) scopeOr.push({ departmentId: staff.departmentId });
    if (staff?.designationId)
      scopeOr.push({ scopeType: 'DESIGNATION', scopeId: staff.designationId });
    if (this.isUuid(staff?.staffType))
      scopeOr.push({ scopeType: 'CATEGORY', scopeId: staff.staffType });
    const candidates = await this.db().staffAttendanceShiftAssignment.findMany({
      where: {
        tenantId,
        active: true,
        effectiveFrom: { lte: date },
        AND: [
          { OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }] },
          { OR: scopeOr },
        ],
      },
      orderBy: [{ priority: 'asc' }, { updatedAt: 'desc' }],
      take: 10,
    });
    return candidates[0] ?? null;
  }

  private async resolveShiftRule(
    tenantId: string,
    assignment: any,
    departmentRule: any,
    staff: any,
    calendar: any,
  ) {
    if (calendar?.shiftRuleId) {
      return this.db().staffAttendanceShiftRule.findFirst({
        where: { id: calendar.shiftRuleId, tenantId, active: true },
        include: { breaks: { orderBy: { sortOrder: 'asc' } } },
      });
    }
    if (assignment?.shiftRuleId) {
      return this.db().staffAttendanceShiftRule.findFirst({
        where: { id: assignment.shiftRuleId, tenantId, active: true },
        include: { breaks: { orderBy: { sortOrder: 'asc' } } },
      });
    }
    if (departmentRule?.shiftRuleId) {
      return this.db().staffAttendanceShiftRule.findFirst({
        where: { id: departmentRule.shiftRuleId, tenantId, active: true },
        include: { breaks: { orderBy: { sortOrder: 'asc' } } },
      });
    }
    if (staff?.primaryShiftId) {
      const linkedRule = await this.db().staffAttendanceShiftRule.findFirst({
        where: { tenantId, shiftId: staff.primaryShiftId, active: true },
        include: { breaks: { orderBy: { sortOrder: 'asc' } } },
      });
      if (linkedRule) return linkedRule;
      const coreShift = staff.primaryShift;
      if (coreShift?.code) {
        const codeRule = await this.db().staffAttendanceShiftRule.findFirst({
          where: { tenantId, shortCode: String(coreShift.code), active: true },
          include: { breaks: { orderBy: { sortOrder: 'asc' } } },
        });
        if (codeRule) return { ...codeRule, shiftId: staff.primaryShiftId };
      }
      if (coreShift?.name) {
        const nameRules = await this.db().staffAttendanceShiftRule.findMany({
          where: { tenantId, active: true },
          include: { breaks: { orderBy: { sortOrder: 'asc' } } },
          take: 50,
        });
        const nameRule = nameRules.find(
          (rule: any) =>
            this.normalized(rule.name) === this.normalized(coreShift.name),
        );
        if (nameRule) return { ...nameRule, shiftId: staff.primaryShiftId };
      }
      if (coreShift) {
        return this.coreShiftRule(tenantId, coreShift);
      }
    }
    return this.db().staffAttendanceShiftRule.findFirst({
      where: { tenantId, active: true },
      orderBy: { createdAt: 'asc' },
      include: { breaks: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  private async resolveCalendar(
    tenantId: string,
    departmentId: string | null | undefined,
    date: Date,
  ) {
    const calendarOr: Array<Record<string, unknown>> = [{ departmentId: null }];
    if (departmentId) calendarOr.unshift({ departmentId });
    const calendars = await this.db().staffAttendanceShiftCalendar.findMany({
      where: {
        tenantId,
        calendarDate: date,
        OR: calendarOr,
      },
      orderBy: [{ departmentId: 'desc' }, { updatedAt: 'desc' }],
      take: 5,
    });
    return calendars[0] ?? null;
  }

  private async resolveOvertimeRule(
    tenantId: string,
    shiftRule: any,
    departmentRule: any,
  ) {
    if (departmentRule?.otRuleId) {
      return this.db().staffOvertimeRule.findFirst({
        where: { id: departmentRule.otRuleId, tenantId, active: true },
      });
    }
    if (shiftRule?.otEligible) {
      return this.db().staffOvertimeRule.findFirst({
        where: { tenantId, active: true, eligible: true },
        orderBy: { createdAt: 'asc' },
      });
    }
    return null;
  }

  private async resolveHoliday(
    tenantId: string,
    departmentId: string | null | undefined,
    date: Date,
  ) {
    const holidays = await this.db().staffPublicHoliday.findMany({
      where: { tenantId, holidayDate: date, active: true },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });
    return (
      holidays.find((holiday: any) => {
        if (!departmentId || !Array.isArray(holiday.departmentIds)) return true;
        return holiday.departmentIds.includes(departmentId);
      }) ?? null
    );
  }

  private async resolveLeave(
    tenantId: string,
    staffProfileId: string | null | undefined,
    date: Date,
  ) {
    if (!staffProfileId) return null;
    const delegates = this.db();
    const leaveDelegate =
      delegates.staffLeaveRequest ?? delegates.staffLeaveApplication;
    if (!leaveDelegate?.findFirst) return null;
    return leaveDelegate.findFirst({
      where: {
        tenantId,
        staffProfileId,
        status: { in: ['APPROVED', 'SANCTIONED'] },
        fromDate: { lte: date },
        toDate: { gte: date },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  private resolveDayRule(
    master: Record<string, any>,
    shiftRule: Record<string, any> | null,
    calendar: Record<string, any> | null,
    date: Date,
  ): EffectiveDayRule | null {
    if (
      calendar?.status &&
      ['WEEKLY_OFF', 'HOLIDAY', 'OFF', 'NON_WORKING_DAY'].includes(
        String(calendar.status),
      )
    ) {
      return {
        dayName: this.dayName(date),
        workingDay: false,
        beginTime: shiftRule?.beginTime ?? '09:00',
        endTime: shiftRule?.endTime ?? '17:00',
        lateGraceMin: Number(shiftRule?.lateGraceMin ?? 0),
        earlyExitGraceMin: Number(shiftRule?.earlyExitGraceMin ?? 0),
        minWorkMinutes: Number(shiftRule?.minWorkMinutes ?? 240),
        halfDayMinutes: Number(shiftRule?.halfDayMinutes ?? 240),
        fullDayMinutes: Number(shiftRule?.fullDayMinutes ?? 420),
        otEligible: Boolean(shiftRule?.otEligible),
        minOtThresholdMin: Number(shiftRule?.minOtThresholdMin ?? 0),
        maxDailyOtMin: Number(shiftRule?.maxDailyOtMin ?? 0),
        crossMidnight: Boolean(shiftRule?.crossMidnight),
        source: 'CALENDAR_OFF',
      };
    }
    if (!shiftRule) return null;

    const settings = this.asRecord(shiftRule.settings);
    const weekly = this.asRecord(settings.weeklySchedule);
    const dayName = this.dayName(date);
    const dayConfig = this.asRecord(
      weekly[dayName] ?? weekly[dayName.toLowerCase()],
    );
    const weekend = this.asRecord(master.weekendConfiguration);
    const workingWeek = Array.isArray(master.workingWeek)
      ? master.workingWeek.map((item: unknown) => String(item).toUpperCase())
      : [];
    const markedOff = String(
      dayConfig.status ?? weekend[dayName] ?? '',
    ).toUpperCase();
    const workingDay =
      dayConfig.workingDay != null
        ? Boolean(dayConfig.workingDay)
        : markedOff
          ? !['OFF', 'WEEKLY_OFF', 'NON_WORKING_DAY'].includes(markedOff)
          : !workingWeek.length || workingWeek.includes(dayName);

    const beginTime = String(
      dayConfig.beginTime ?? dayConfig.startTime ?? shiftRule.beginTime,
    );
    let endTime = String(dayConfig.endTime ?? shiftRule.endTime);
    if (
      dayName === 'SATURDAY' &&
      shiftRule.saturdayHalfDay &&
      shiftRule.saturdayHalfDayEndTime &&
      !dayConfig.endTime
    ) {
      endTime = String(shiftRule.saturdayHalfDayEndTime);
    }

    return {
      dayName,
      workingDay,
      beginTime,
      endTime,
      lateGraceMin: Number(
        dayConfig.lateGraceMin ?? shiftRule.lateGraceMin ?? 0,
      ),
      earlyExitGraceMin: Number(
        dayConfig.earlyExitGraceMin ?? shiftRule.earlyExitGraceMin ?? 0,
      ),
      halfDayAfter: this.optionalString(
        dayConfig.halfDayAfter ?? settings.halfDayAfter,
      ),
      absentAfter: this.optionalString(
        dayConfig.absentAfter ?? settings.absentAfter,
      ),
      minWorkMinutes: Number(
        dayConfig.minWorkMinutes ?? shiftRule.minWorkMinutes ?? 240,
      ),
      halfDayMinutes: Number(
        dayConfig.halfDayMinutes ?? shiftRule.halfDayMinutes ?? 240,
      ),
      fullDayMinutes: Number(
        dayConfig.fullDayMinutes ?? shiftRule.fullDayMinutes ?? 420,
      ),
      otEligible: Boolean(dayConfig.otEligible ?? shiftRule.otEligible),
      otStartAfter: this.optionalString(
        dayConfig.otStartAfter ?? settings.otStartAfter,
      ),
      minOtThresholdMin: Number(
        dayConfig.minOtThresholdMin ?? shiftRule.minOtThresholdMin ?? 0,
      ),
      maxDailyOtMin: Number(
        dayConfig.maxDailyOtMin ?? shiftRule.maxDailyOtMin ?? 0,
      ),
      crossMidnight: Boolean(
        dayConfig.crossMidnight ?? shiftRule.crossMidnight,
      ),
      source:
        dayConfig.beginTime || dayConfig.endTime
          ? 'WEEKLY_SCHEDULE'
          : dayName === 'SATURDAY' && shiftRule.saturdayHalfDay
            ? 'SATURDAY_HALF_DAY'
            : 'SHIFT_RULE',
    };
  }

  private dayName(value: Date) {
    return [
      'SUNDAY',
      'MONDAY',
      'TUESDAY',
      'WEDNESDAY',
      'THURSDAY',
      'FRIDAY',
      'SATURDAY',
    ][value.getDay()];
  }

  private asRecord(value: unknown): Record<string, any> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, any>)
      : {};
  }

  private optionalString(value: unknown) {
    return value == null || value === '' ? null : String(value);
  }

  private coreShiftRule(tenantId: string, shift: Record<string, unknown>) {
    const beginTime = this.timeString(shift.startTime) ?? '09:00';
    const endTime = this.timeString(shift.endTime) ?? '17:00';
    return {
      id: `core:${shift.id}`,
      tenantId,
      shiftId: shift.id,
      name: String(shift.name ?? 'Assigned Shift'),
      shortCode: String(shift.code ?? 'CORE'),
      active: true,
      beginTime,
      endTime,
      lateGraceMin: 10,
      earlyExitGraceMin: 5,
      minWorkMinutes: 240,
      halfDayMinutes: 240,
      fullDayMinutes: 420,
      saturdayHalfDay: false,
      otEligible: false,
      minOtThresholdMin: 0,
      maxDailyOtMin: 0,
      crossMidnight: endTime <= beginTime,
      settings: {},
      breaks: [],
    };
  }

  private timeString(value: unknown) {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString().slice(11, 16);
    const text = String(value);
    const match = text.match(/(\d{1,2}):(\d{2})/);
    if (!match) return null;
    return `${match[1].padStart(2, '0')}:${match[2]}`;
  }

  private normalized(value: unknown) {
    return String(value ?? '')
      .replace(/[^a-z0-9]/gi, '')
      .toUpperCase();
  }

  private isUuid(value: unknown) {
    return (
      typeof value === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      )
    );
  }

  private dateOnly(value: Date) {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
  }
}
