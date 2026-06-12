import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { QueueService } from '../../shared/queue/queue.service';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import type {
  AttendanceMasterSettingsDto,
  AttendanceReprocessDto,
  AttendanceSettingsRecordDto,
} from './dto/staff-attendance.dto';
import { AttendancePolicyEngineService } from './attendance-policy-engine.service';

const RESOURCE_MODEL: Record<string, string> = {
  'shift-rules': 'staffAttendanceShiftRule',
  'shift-groups': 'staffAttendanceShiftGroup',
  'shift-calendar': 'staffAttendanceShiftCalendar',
  'shift-assignments': 'staffAttendanceShiftAssignment',
  'leave-types': 'staffLeaveType',
  'employee-categories': 'staffEmployeeCategory',
  holidays: 'staffPublicHoliday',
  'department-rules': 'staffDepartmentAttendanceRule',
  'ot-rules': 'staffOvertimeRule',
  'processing-runs': 'staffAttendanceProcessingRun',
};

@Injectable()
export class AttendanceSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly policy: AttendancePolicyEngineService,
  ) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  async overview(tenantId: string) {
    await this.ensureDefaults(tenantId);
    const [
      master,
      shiftRules,
      shiftGroups,
      leaveTypes,
      categories,
      holidays,
      departmentRules,
      otRules,
      processingRuns,
    ] = await Promise.all([
      this.policy.getMasterSettings(tenantId),
      this.db().staffAttendanceShiftRule.findMany({
        where: { tenantId },
        include: { breaks: { orderBy: { sortOrder: 'asc' } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.db().staffAttendanceShiftGroup.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      }),
      this.db().staffLeaveType.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      }),
      this.db().staffEmployeeCategory.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      }),
      this.db().staffPublicHoliday.findMany({
        where: { tenantId },
        orderBy: { holidayDate: 'asc' },
        take: 200,
      }),
      this.db().staffDepartmentAttendanceRule.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      }),
      this.db().staffOvertimeRule.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      }),
      this.db().staffAttendanceProcessingRun.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 25,
      }),
    ]);
    return {
      master,
      shiftRules,
      shiftGroups,
      leaveTypes,
      employeeCategories: categories,
      holidays,
      departmentRules,
      otRules,
      processingRuns,
      counts: {
        shiftRules: shiftRules.length,
        shiftGroups: shiftGroups.length,
        leaveTypes: leaveTypes.length,
        employeeCategories: categories.length,
        holidays: holidays.length,
        departmentRules: departmentRules.length,
        otRules: otRules.length,
      },
    };
  }

  async getMaster(tenantId: string) {
    return this.policy.getMasterSettings(tenantId);
  }

  async updateMaster(user: JwtUser, dto: AttendanceMasterSettingsDto) {
    const previous = await this.policy.getMasterSettings(user.tid);
    const updated = await this.db().staffAttendanceMasterSetting.update({
      where: { tenantId: user.tid },
      data: dto,
    });
    await this.audit(
      user,
      'ATTENDANCE_MASTER_SETTINGS_UPDATE',
      'ATTENDANCE_MASTER_SETTINGS',
      updated.id,
      { previous, next: updated },
    );
    return updated;
  }

  async list(tenantId: string, resource: string) {
    const delegate = this.delegate(resource);
    return delegate.findMany({
      where: { tenantId },
      orderBy:
        resource === 'holidays'
          ? { holidayDate: 'asc' }
          : { createdAt: 'desc' },
      ...(resource === 'shift-rules'
        ? { include: { breaks: { orderBy: { sortOrder: 'asc' } } } }
        : {}),
      take: 500,
    });
  }

  async create(
    user: JwtUser,
    resource: string,
    dto: AttendanceSettingsRecordDto,
  ) {
    const row =
      resource === 'shift-rules'
        ? await this.createShiftRule(user.tid, dto.data)
        : await this.delegate(resource).create({
            data: { tenantId: user.tid, ...dto.data },
          });
    await this.audit(
      user,
      `ATTENDANCE_${resource.toUpperCase()}_CREATE`,
      resource,
      row.id,
      row,
    );
    return row;
  }

  async update(
    user: JwtUser,
    resource: string,
    id: string,
    dto: AttendanceSettingsRecordDto,
  ) {
    const delegate = this.delegate(resource);
    const previous = await delegate.findFirst({
      where: { id, tenantId: user.tid },
    });
    if (!previous)
      throw new NotFoundException('Attendance settings record not found');
    const updated =
      resource === 'shift-rules'
        ? await this.updateShiftRule(user.tid, id, dto.data)
        : await delegate.update({ where: { id }, data: dto.data });
    await this.audit(
      user,
      `ATTENDANCE_${resource.toUpperCase()}_UPDATE`,
      resource,
      id,
      { previous, next: updated },
    );
    return updated;
  }

  async remove(user: JwtUser, resource: string, id: string) {
    const delegate = this.delegate(resource);
    const previous = await delegate.findFirst({
      where: { id, tenantId: user.tid },
    });
    if (!previous)
      throw new NotFoundException('Attendance settings record not found');
    const updated =
      'active' in previous
        ? await delegate.update({ where: { id }, data: { active: false } })
        : await delegate.delete({ where: { id } });
    await this.audit(
      user,
      `ATTENDANCE_${resource.toUpperCase()}_DISABLE`,
      resource,
      id,
      { previous, next: updated },
    );
    return updated;
  }

  async seedDefaults(user: JwtUser) {
    const result = await this.ensureDefaults(user.tid);
    await this.audit(
      user,
      'ATTENDANCE_SETTINGS_DEFAULTS_SEEDED',
      'ATTENDANCE_SETTINGS',
      undefined,
      result,
    );
    return result;
  }

  async reprocess(user: JwtUser, dto: AttendanceReprocessDto) {
    const from = dto.from ? new Date(dto.from) : this.today();
    const to = dto.to ? new Date(dto.to) : from;
    const run = await this.db().staffAttendanceProcessingRun.create({
      data: {
        tenantId: user.tid,
        mode: dto.mode ?? 'MANUAL',
        scopeType: dto.staffProfileId
          ? 'STAFF'
          : dto.departmentId
            ? 'DEPARTMENT'
            : 'ALL',
        staffProfileId: dto.staffProfileId,
        departmentId: dto.departmentId,
        fromDate: from,
        toDate: to,
        requestedById: user.sub,
      },
    });
    await this.queue.enqueueStaffAttendanceReprocessRun({
      tenantId: user.tid,
      runId: run.id,
    });
    await this.audit(
      user,
      'ATTENDANCE_REPROCESS_QUEUED',
      'PROCESSING_RUN',
      run.id,
      run,
      'QUEUED',
    );
    return run;
  }

  private async ensureDefaults(tenantId: string) {
    const master = await this.policy.getMasterSettings(tenantId);
    const [shift, group, otRule] = await Promise.all([
      this.ensureDefaultShift(tenantId),
      this.ensureDefaultGroup(tenantId),
      this.ensureDefaultOtRule(tenantId),
      this.ensureDefaultLeaveTypes(tenantId),
      this.ensureDefaultCategories(tenantId),
    ]);
    return { master, shift, group, otRule };
  }

  private async ensureDefaultShift(tenantId: string) {
    const coreDayShift = await this.findCoreDayShift(tenantId);
    const existing = await this.db().staffAttendanceShiftRule.findFirst({
      where: { tenantId, shortCode: 'DAY' },
    });
    if (existing) {
      if (!existing.shiftId && coreDayShift?.id) {
        return this.db().staffAttendanceShiftRule.update({
          where: { id: existing.id },
          data: { shiftId: coreDayShift.id },
        });
      }
      return existing;
    }
    return this.db().staffAttendanceShiftRule.create({
      data: {
        tenantId,
        shiftId: coreDayShift?.id,
        name: 'Day Shift',
        shortCode: 'DAY',
        description: 'Default higher education staff day shift',
        beginTime: this.timeString(coreDayShift?.startTime) ?? '09:00',
        endTime: this.timeString(coreDayShift?.endTime) ?? '17:00',
        lateGraceMin: 10,
        earlyExitGraceMin: 5,
        fullDayMinutes: 420,
        halfDayMinutes: 240,
        minWorkMinutes: 240,
        breaks: {
          create: [
            {
              tenantId,
              name: 'Lunch',
              beginTime: '13:00',
              endTime: '13:30',
              paid: false,
              mandatory: true,
            },
          ],
        },
      },
    });
  }

  private async findCoreDayShift(tenantId: string) {
    return this.db().shift.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { code: { equals: 'DAY', mode: 'insensitive' } },
          { name: { equals: 'Day Shift', mode: 'insensitive' } },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  private timeString(value: unknown) {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString().slice(11, 16);
    const match = String(value).match(/(\d{1,2}):(\d{2})/);
    return match ? `${match[1].padStart(2, '0')}:${match[2]}` : null;
  }

  private async ensureDefaultGroup(tenantId: string) {
    const existing = await this.db().staffAttendanceShiftGroup.findFirst({
      where: { tenantId, code: 'TEACHING' },
    });
    if (existing) return existing;
    return this.db().staffAttendanceShiftGroup.create({
      data: {
        tenantId,
        code: 'TEACHING',
        name: 'Teaching Staff',
        description: 'Default teaching staff attendance group',
      },
    });
  }

  private async ensureDefaultOtRule(tenantId: string) {
    const existing = await this.db().staffOvertimeRule.findFirst({
      where: { tenantId, code: 'STANDARD' },
    });
    if (existing) return existing;
    return this.db().staffOvertimeRule.create({
      data: {
        tenantId,
        code: 'STANDARD',
        name: 'Standard OT Policy',
        eligible: false,
        minThresholdMin: 30,
        approvalRequired: true,
      },
    });
  }

  private async ensureDefaultLeaveTypes(tenantId: string) {
    for (const leave of [
      ['CL', 'Casual Leave', 12],
      ['SL', 'Sick Leave', 12],
      ['EL', 'Earned Leave', 15],
      ['OD', 'On Duty', 0],
      ['LOP', 'Loss of Pay', 0],
    ]) {
      const exists = await this.db().staffLeaveType.findFirst({
        where: { tenantId, code: leave[0] },
      });
      if (!exists) {
        await this.db().staffLeaveType.create({
          data: {
            tenantId,
            code: leave[0],
            name: leave[1],
            yearlyLimit: leave[2],
          },
        });
      }
    }
  }

  private async ensureDefaultCategories(tenantId: string) {
    for (const category of [
      ['TEACHING', 'Teaching'],
      ['NON_TEACHING', 'Non-Teaching'],
      ['GUEST', 'Guest Faculty'],
      ['SECURITY', 'Security'],
      ['ADMIN', 'Administration'],
    ]) {
      const exists = await this.db().staffEmployeeCategory.findFirst({
        where: { tenantId, code: category[0] },
      });
      if (!exists)
        await this.db().staffEmployeeCategory.create({
          data: { tenantId, code: category[0], name: category[1] },
        });
    }
  }

  private delegate(resource: string) {
    const model = RESOURCE_MODEL[resource];
    if (!model || !this.db()[model])
      throw new BadRequestException(
        `Unsupported attendance settings resource: ${resource}`,
      );
    return this.db()[model];
  }

  private async createShiftRule(
    tenantId: string,
    data: Record<string, unknown>,
  ) {
    const { breaks, ...rest } = data;
    return this.db().staffAttendanceShiftRule.create({
      data: {
        tenantId,
        ...rest,
        breaks: Array.isArray(breaks)
          ? {
              create: breaks.map((row: any, index: number) => ({
                tenantId,
                name: row.name,
                beginTime: row.beginTime,
                endTime: row.endTime,
                paid: Boolean(row.paid),
                mandatory: row.mandatory !== false,
                sortOrder: row.sortOrder ?? index,
              })),
            }
          : undefined,
      },
      include: { breaks: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  private async updateShiftRule(
    tenantId: string,
    id: string,
    data: Record<string, unknown>,
  ) {
    const { breaks, ...rest } = data;
    await this.db().staffAttendanceShiftRule.update({
      where: { id },
      data: rest,
    });
    if (Array.isArray(breaks)) {
      await this.db().staffAttendanceShiftBreak.deleteMany({
        where: { tenantId, shiftRuleId: id },
      });
      if (breaks.length) {
        await this.db().staffAttendanceShiftBreak.createMany({
          data: breaks.map((row: any, index: number) => ({
            tenantId,
            shiftRuleId: id,
            name: row.name,
            beginTime: row.beginTime,
            endTime: row.endTime,
            paid: Boolean(row.paid),
            mandatory: row.mandatory !== false,
            sortOrder: row.sortOrder ?? index,
          })),
        });
      }
    }
    return this.db().staffAttendanceShiftRule.findUnique({
      where: { id },
      include: { breaks: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  private today() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private async audit(
    user: JwtUser,
    action: string,
    entityType: string,
    entityId: string | undefined,
    payload: unknown,
    result = 'SUCCESS',
  ) {
    await this.db().staffAttendanceAuditLog.create({
      data: {
        tenantId: user.tid,
        actorId: user.sub,
        action,
        entityType,
        entityId,
        payload: this.toJson(payload),
        result,
      },
    });
  }

  private toJson(value: unknown) {
    return JSON.parse(JSON.stringify(value ?? {}));
  }
}
