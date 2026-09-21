import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { SchoolSisService } from './school-sis.service';
import { SchoolSisCalendarService } from './school-sis-calendar.service';
import { SchoolSisEventBus } from './school-sis-event-bus.service';
import { resolveSchoolStaffIdForUser } from './school-sis-staff-lookup';
import { istDayKey } from './school-sis-timetable-bells';
import {
  mergeAttendancePolicy,
  policyFromSettingsRow,
  anyNotifyChannel,
  notifyChannels,
} from './school-sis-attendance.policy';
import {
  attendancePercent,
  attendanceStatusLabel,
  bandForPercent,
  DEFAULT_ATTENDANCE_STATUSES,
  DEFAULT_LEAVE_TYPES,
  REGISTER_LETTER,
  unitForStatus,
} from './school-sis-attendance.rules';
import type {
  AttendanceCorrectionDto,
  AttendanceSyncDto,
  BulkNotifyDto,
  CreateLeaveDto,
  QrScanDto,
  SaveAttendanceClassRuleDto,
  SaveAttendanceRosterDto,
  SaveAttendanceSettingsDto,
  SaveAttendanceStatusDto,
  SaveLeaveTypeDto,
  SubmitAttendanceDto,
  SubstituteDto,
  UnlockAttendanceDto,
} from './dto/school-attendance.dto';

export type AttendanceActor = {
  userId: string;
  email?: string;
  manage: boolean;
  canApprove: boolean;
  canLock: boolean;
  ip?: string;
  deviceId?: string;
};

function dayKey(d: Date | string) {
  const s =
    typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10);
  return s;
}

function parseDay(value: string | Date) {
  const s = typeof value === 'string' ? value.slice(0, 10) : dayKey(value);
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function settingsUnits(row: {
  lateCountsPresent: boolean;
  halfDayValue: Prisma.Decimal | number;
  leaveCountsPresent: boolean;
  excusedCountsPresent: boolean;
  policy?: unknown;
}) {
  const policy = policyFromSettingsRow(row);
  return {
    lateCountsPresent: row.lateCountsPresent,
    halfDayValue: Number(row.halfDayValue),
    leaveCountsPresent: row.leaveCountsPresent,
    excusedCountsPresent: row.excusedCountsPresent,
    presentWeight: policy.presentWeight,
    lateWeight: policy.lateWeight,
    absentWeight: policy.absentWeight,
  };
}

function presentSettings<
  T extends { halfDayValue: Prisma.Decimal | number; policy?: unknown },
>(row: T) {
  const policy = policyFromSettingsRow(row);
  return {
    ...row,
    halfDayValue: Number(row.halfDayValue),
    ...policy,
    policy,
  };
}

function settingsSnapshot(row: {
  mode: string;
  defaultStatus: string;
  defaultMarking: string;
  lockEnabled: boolean;
  lockAfterHours: number;
  correctionRequired: boolean;
  minPercent: number;
  warnPercent: number;
  lateCountsPresent: boolean;
  halfDayValue: Prisma.Decimal | number;
  leaveCountsPresent: boolean;
  excusedCountsPresent: boolean;
  absentNotify: boolean;
  lateNotify: boolean;
  lowAttendanceNotify: boolean;
  consecutiveAbsentAlert: number;
  policy?: unknown;
}) {
  return {
    mode: row.mode,
    defaultStatus: row.defaultStatus,
    defaultMarking: row.defaultMarking,
    lockEnabled: row.lockEnabled,
    lockAfterHours: row.lockAfterHours,
    correctionRequired: row.correctionRequired,
    minPercent: row.minPercent,
    warnPercent: row.warnPercent,
    lateCountsPresent: row.lateCountsPresent,
    halfDayValue: Number(row.halfDayValue),
    leaveCountsPresent: row.leaveCountsPresent,
    excusedCountsPresent: row.excusedCountsPresent,
    absentNotify: row.absentNotify,
    lateNotify: row.lateNotify,
    lowAttendanceNotify: row.lowAttendanceNotify,
    consecutiveAbsentAlert: row.consecutiveAbsentAlert,
    policy: policyFromSettingsRow(row),
  };
}

@Injectable()
export class SchoolSisAttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sis: SchoolSisService,
    private readonly calendar: SchoolSisCalendarService,
    private readonly events: SchoolSisEventBus,
  ) {}

  private async year(tenantId: string, academicYearId?: string) {
    if (academicYearId) {
      const row = await this.prisma.schoolAcademicYear.findFirst({
        where: { id: academicYearId, tenantId, deletedAt: null },
      });
      if (!row) throw new NotFoundException('Academic year not found');
      return row;
    }
    return this.sis.currentYear(tenantId);
  }

  async ensureSetup(tenantId: string, academicYearId?: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const year = await this.year(tenantId, academicYearId);
    const existing = await this.prisma.schoolAttendanceSettings.findUnique({
      where: { tenantId_academicYearId: { tenantId, academicYearId: year.id } },
    });
    if (!existing) {
      await this.prisma.schoolAttendanceSettings.create({
        data: { tenantId, academicYearId: year.id },
      });
    }
    const statusCount = await this.prisma.schoolAttendanceStatus.count({
      where: { tenantId },
    });
    if (statusCount === 0) {
      await this.prisma.schoolAttendanceStatus.createMany({
        data: DEFAULT_ATTENDANCE_STATUSES.map((s) => ({
          tenantId,
          code: s.code,
          shortCode: s.shortCode,
          name: s.name,
          countsPresent: s.countsPresent,
          countsAbsent: s.countsAbsent,
          attendanceValue: s.attendanceValue,
          requiresRemark: s.requiresRemark,
          isSystem: true,
          sortOrder: s.sortOrder,
        })),
      });
    }
    const leaveCount = await this.prisma.schoolAttendanceLeaveType.count({
      where: { tenantId },
    });
    if (leaveCount === 0) {
      await this.prisma.schoolAttendanceLeaveType.createMany({
        data: DEFAULT_LEAVE_TYPES.map((t) => ({
          tenantId,
          code: t.code,
          name: t.name,
          countsAsPresent: t.countsAsPresent,
          sortOrder: t.sortOrder,
        })),
      });
    }
    return this.prisma.schoolAttendanceSettings.findUniqueOrThrow({
      where: { tenantId_academicYearId: { tenantId, academicYearId: year.id } },
    });
  }

  async getSettings(tenantId: string, academicYearId?: string) {
    const settings = await this.ensureSetup(tenantId, academicYearId);
    const [statuses, leaveTypes, classRules, audit] = await Promise.all([
      this.prisma.schoolAttendanceStatus.findMany({
        where: { tenantId },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.schoolAttendanceLeaveType.findMany({
        where: { tenantId },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.schoolAttendanceClassRule.findMany({
        where: { tenantId, academicYearId: settings.academicYearId },
        include: {
          grade: { select: { id: true, name: true } },
          section: { select: { id: true, name: true } },
          academicYear: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.schoolAttendanceAudit.findMany({
        where: { tenantId, action: 'SETTINGS_CHANGE' },
        orderBy: { createdAt: 'desc' },
        take: 40,
      }),
    ]);
    return {
      settings: presentSettings(settings),
      statuses,
      leaveTypes,
      classRules,
      audit,
    };
  }

  async saveSettings(
    tenantId: string,
    dto: SaveAttendanceSettingsDto,
    academicYearId?: string,
    actorId?: string,
  ) {
    const year = await this.year(
      tenantId,
      dto.academicYearId || academicYearId,
    );
    const current = await this.ensureSetup(tenantId, year.id);
    const nextPolicy = mergeAttendancePolicy({
      ...policyFromSettingsRow(current),
      ...(dto.policy ?? {}),
    });
    const lateCountsPresent =
      dto.lateCountsPresent ?? nextPolicy.lateWeight > 0;
    const correctionRequired =
      dto.correctionRequired ?? !nextPolicy.teacherCanEditSubmitted;
    const lockAfterHours =
      dto.lockAfterHours ??
      (nextPolicy.lockMode === 'AFTER_DAYS'
        ? Math.max(1, nextPolicy.lockAfterDays) * 24
        : current.lockAfterHours);
    const updated = await this.prisma.schoolAttendanceSettings.update({
      where: { tenantId_academicYearId: { tenantId, academicYearId: year.id } },
      data: {
        mode: dto.mode,
        defaultStatus: dto.defaultStatus,
        defaultMarking: dto.defaultMarking,
        lockEnabled: dto.lockEnabled,
        lockAfterHours,
        correctionRequired,
        minPercent: dto.minPercent,
        warnPercent: dto.warnPercent,
        lateCountsPresent,
        halfDayValue: dto.halfDayValue,
        leaveCountsPresent: dto.leaveCountsPresent,
        excusedCountsPresent: dto.excusedCountsPresent,
        absentNotify: dto.absentNotify,
        lateNotify: dto.lateNotify,
        lowAttendanceNotify: dto.lowAttendanceNotify,
        consecutiveAbsentAlert: dto.consecutiveAbsentAlert,
        reminderHour: dto.reminderHour,
        reminderMinute: dto.reminderMinute,
        lateThresholdMin: dto.lateThresholdMin,
        gracePeriodMin: dto.gracePeriodMin,
        qrEnabled: dto.qrEnabled,
        geoEnabled: dto.geoEnabled,
        geoRadiusM: dto.geoRadiusM,
        policy: nextPolicy as unknown as Prisma.InputJsonValue,
      },
    });
    await this.prisma.schoolAttendanceAudit.create({
      data: {
        tenantId,
        actorId,
        action: 'SETTINGS_CHANGE',
        oldStatus: JSON.stringify(settingsSnapshot(current)),
        newStatus: JSON.stringify(settingsSnapshot(updated)),
        metadata: {
          before: settingsSnapshot(current),
          after: settingsSnapshot(updated),
        },
      },
    });
    return presentSettings(updated);
  }

  async saveStatus(
    tenantId: string,
    dto: SaveAttendanceStatusDto,
    id?: string,
    actorId?: string,
  ) {
    await this.ensureSetup(tenantId);
    const code = dto.code.toUpperCase().trim();
    const shortCode = (dto.shortCode || code.slice(0, 2)).toUpperCase().trim();
    const dupCode = await this.prisma.schoolAttendanceStatus.findFirst({
      where: { tenantId, code, ...(id ? { NOT: { id } } : {}) },
    });
    if (dupCode) throw new ConflictException('Status code already exists.');
    const dupShort = await this.prisma.schoolAttendanceStatus.findFirst({
      where: { tenantId, shortCode, ...(id ? { NOT: { id } } : {}) },
    });
    if (dupShort)
      throw new ConflictException('Status short code already exists.');
    const data = {
      code,
      shortCode,
      name: dto.name,
      description: dto.description,
      countsPresent: dto.countsPresent ?? false,
      countsAbsent: dto.countsAbsent ?? false,
      countsTowardPct: dto.countsTowardPct ?? true,
      attendanceValue: dto.attendanceValue ?? 0,
      requiresApproval: dto.requiresApproval ?? false,
      requiresRemark: dto.requiresRemark ?? false,
      active: dto.active ?? true,
      sortOrder: dto.sortOrder ?? 99,
    };
    const row = id
      ? await this.prisma.schoolAttendanceStatus.findFirst({
          where: { id, tenantId },
        })
      : null;
    if (id && !row) throw new NotFoundException('Status not found');
    if (row?.isSystem) data.code = row.code;
    const saved = id
      ? await this.prisma.schoolAttendanceStatus.update({ where: { id }, data })
      : await this.prisma.schoolAttendanceStatus.create({
          data: { tenantId, ...data, isSystem: false },
        });
    await this.prisma.schoolAttendanceAudit.create({
      data: {
        tenantId,
        actorId,
        action: 'SETTINGS_CHANGE',
        reason: id ? 'status.update' : 'status.create',
        oldStatus: row ? row.code : null,
        newStatus: saved.code,
        metadata: { status: saved },
      },
    });
    return saved;
  }

  async saveLeaveType(tenantId: string, dto: SaveLeaveTypeDto, id?: string) {
    await this.ensureSetup(tenantId);
    const data = {
      code: dto.code.toUpperCase(),
      name: dto.name,
      countsAsPresent: dto.countsAsPresent ?? false,
      requiresDocument: dto.requiresDocument ?? false,
      active: dto.active ?? true,
    };
    if (id) {
      return this.prisma.schoolAttendanceLeaveType.update({
        where: { id },
        data,
      });
    }
    return this.prisma.schoolAttendanceLeaveType.create({
      data: { tenantId, ...data },
    });
  }

  async saveClassRule(
    tenantId: string,
    dto: SaveAttendanceClassRuleDto,
    actorId?: string,
  ) {
    const year = await this.year(tenantId, dto.academicYearId);
    await this.ensureSetup(tenantId, year.id);
    const grade = await this.prisma.schoolGrade.findFirst({
      where: { id: dto.gradeId, tenantId, deletedAt: null },
    });
    if (!grade) throw new NotFoundException('Class not found');
    if (dto.sectionId) {
      const section = await this.prisma.schoolSection.findFirst({
        where: {
          id: dto.sectionId,
          tenantId,
          gradeId: dto.gradeId,
          deletedAt: null,
        },
      });
      if (!section) throw new NotFoundException('Section not found');
    }
    const dup = await this.prisma.schoolAttendanceClassRule.findFirst({
      where: {
        tenantId,
        academicYearId: year.id,
        gradeId: dto.gradeId,
        sectionId: dto.sectionId ?? null,
        ...(dto.id ? { NOT: { id: dto.id } } : {}),
      },
    });
    if (dup)
      throw new ConflictException(
        'A rule already exists for this class, section and year.',
      );
    const data = {
      academicYearId: year.id,
      gradeId: dto.gradeId,
      sectionId: dto.sectionId ?? null,
      mode: (dto.mode || 'DAILY').toUpperCase(),
      active: dto.active ?? true,
    };
    if (dto.id) {
      const existing = await this.prisma.schoolAttendanceClassRule.findFirst({
        where: { id: dto.id, tenantId },
      });
      if (!existing) throw new NotFoundException('Class rule not found');
    }
    const saved = dto.id
      ? await this.prisma.schoolAttendanceClassRule.update({
          where: { id: dto.id },
          data,
        })
      : await this.prisma.schoolAttendanceClassRule.create({
          data: { tenantId, ...data },
        });
    await this.prisma.schoolAttendanceAudit.create({
      data: {
        tenantId,
        actorId,
        action: 'SETTINGS_CHANGE',
        reason: dto.id ? 'class_rule.update' : 'class_rule.create',
        metadata: { classRule: saved },
      },
    });
    return saved;
  }

  async deleteClassRule(tenantId: string, id: string, actorId?: string) {
    const row = await this.prisma.schoolAttendanceClassRule.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Class rule not found');
    await this.prisma.schoolAttendanceClassRule.delete({ where: { id } });
    await this.prisma.schoolAttendanceAudit.create({
      data: {
        tenantId,
        actorId,
        action: 'SETTINGS_CHANGE',
        reason: 'class_rule.delete',
        metadata: { classRule: row },
      },
    });
    return { ok: true };
  }

  private async resolveClassRule(
    tenantId: string,
    yearId: string,
    sectionId: string,
  ) {
    const section = await this.prisma.schoolSection.findFirst({
      where: { id: sectionId, tenantId, deletedAt: null },
      select: { id: true, gradeId: true },
    });
    if (!section) return null;
    const specific = await this.prisma.schoolAttendanceClassRule.findFirst({
      where: {
        tenantId,
        academicYearId: yearId,
        gradeId: section.gradeId,
        sectionId: section.id,
        active: true,
      },
    });
    if (specific) return specific;
    return this.prisma.schoolAttendanceClassRule.findFirst({
      where: {
        tenantId,
        academicYearId: yearId,
        gradeId: section.gradeId,
        sectionId: null,
        active: true,
      },
    });
  }

  private workingDays(
    tenantId: string,
    from: string,
    to: string,
    yearId: string,
    settings: { policy?: unknown; lateCountsPresent?: boolean },
  ) {
    return this.calendar.workingDaysInRange(
      tenantId,
      from,
      to,
      yearId,
      policyFromSettingsRow(settings),
    );
  }

  private async assertWorkingDay(
    tenantId: string,
    date: string,
    yearId: string,
    settings?: { policy?: unknown; lateCountsPresent?: boolean },
  ) {
    const day = await this.calendar.resolveDay(tenantId, date, yearId);
    const policy = settings ? policyFromSettingsRow(settings) : undefined;
    if (!this.calendar.isWorkingKind(day.kind, policy)) {
      throw new BadRequestException(
        `Attendance is not required on this date (${day.kind.replace('_', ' ')}).`,
      );
    }
    const year = await this.year(tenantId, yearId);
    const d = parseDay(date);
    if (d < parseDay(year.startDate) || d > parseDay(year.endDate)) {
      throw new BadRequestException(
        'Attendance date is outside the academic year.',
      );
    }
    return day;
  }

  private async enrollments(
    tenantId: string,
    yearId: string,
    sectionId: string,
  ) {
    return this.prisma.schoolEnrollment.findMany({
      where: {
        tenantId,
        academicYearId: yearId,
        sectionId,
        status: 'ACTIVE',
        deletedAt: null,
        student: { deletedAt: null, status: 'ACTIVE' },
      },
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            admissionNumber: true,
            photoUrl: true,
            phone: true,
            guardians: {
              include: {
                guardian: {
                  select: { fullName: true, phone: true, email: true },
                },
              },
            },
          },
        },
      },
      orderBy: [{ rollNumber: 'asc' }, { student: { fullName: 'asc' } }],
    });
  }

  private effectiveStatus(
    session: {
      status: string;
      submittedAt: Date | null;
      lockedAt: Date | null;
      date?: Date;
    },
    settings: {
      lockEnabled: boolean;
      lockAfterHours: number;
      policy?: unknown;
      lateCountsPresent?: boolean;
    },
  ) {
    if (session.lockedAt) return 'LOCKED';
    if (session.status === 'LOCKED') return 'LOCKED';
    const policy = policyFromSettingsRow(settings);
    if (!settings.lockEnabled) return session.status;
    if (
      session.status !== 'SUBMITTED' &&
      session.status !== 'CORRECTION_REQUESTED'
    ) {
      if (policy.lockMode === 'END_OF_DAY' && session.date) {
        const endIst = this.endOfIstDay(session.date);
        if (Date.now() >= endIst && session.status === 'DRAFT') {
          return session.status;
        }
      }
      return session.status;
    }
    if (policy.lockMode === 'AFTER_SUBMIT') return 'LOCKED';
    if (session.submittedAt && policy.lockMode === 'AFTER_HOURS') {
      const lockAt =
        session.submittedAt.getTime() + settings.lockAfterHours * 3600_000;
      if (Date.now() >= lockAt) return 'LOCKED';
    }
    if (session.submittedAt && policy.lockMode === 'AFTER_DAYS') {
      const lockAt =
        session.submittedAt.getTime() +
        Math.max(0, policy.lockAfterDays) * 86_400_000;
      if (Date.now() >= lockAt) return 'LOCKED';
    }
    if (policy.lockMode === 'END_OF_DAY' && session.date) {
      if (Date.now() >= this.endOfIstDay(session.date)) return 'LOCKED';
    }
    return session.status;
  }

  private endOfIstDay(date: Date) {
    const key = dayKey(date);
    const [y, m, d] = key.split('-').map(Number);
    return Date.UTC(y, m - 1, d, 18, 29, 59, 999);
  }

  async dashboard(
    tenantId: string,
    q: {
      academicYearId?: string;
      date?: string;
      gradeId?: string;
      sectionIds?: string[] | null;
    },
  ) {
    const year = await this.year(tenantId, q.academicYearId);
    const settings = await this.ensureSetup(tenantId, year.id);
    const date = q.date ? dayKey(q.date) : istDayKey();
    const sectionWhere: Prisma.SchoolSectionWhereInput = {
      tenantId,
      academicYearId: year.id,
      deletedAt: null,
      active: true,
      ...(q.gradeId ? { gradeId: q.gradeId } : {}),
      ...(q.sectionIds ? { id: { in: q.sectionIds } } : {}),
    };
    const sections = await this.prisma.schoolSection.findMany({
      where: sectionWhere,
      include: { grade: { select: { id: true, name: true, sortOrder: true } } },
      orderBy: [{ grade: { sortOrder: 'asc' } }, { name: 'asc' }],
    });
    const sectionIds = sections.map((s) => s.id);
    const [enrollCounts, sessions, holiday] = await Promise.all([
      this.prisma.schoolEnrollment.groupBy({
        by: ['sectionId'],
        where: {
          tenantId,
          academicYearId: year.id,
          status: 'ACTIVE',
          deletedAt: null,
          ...(sectionIds.length
            ? { sectionId: { in: sectionIds } }
            : { sectionId: 'none' }),
        },
        _count: { _all: true },
      }),
      this.prisma.schoolAttendanceSession.findMany({
        where: {
          tenantId,
          academicYearId: year.id,
          date: parseDay(date),
          mode: 'DAILY',
          periodKey: 'DAILY',
          sectionId: { in: sectionIds.length ? sectionIds : ['none'] },
        },
        include: { records: true, section: { include: { grade: true } } },
      }),
      this.calendar.resolveDay(tenantId, date, year.id),
    ]);
    const enrollMap = new Map(
      enrollCounts.map((e) => [e.sectionId, e._count._all]),
    );
    const totals = {
      students: 0,
      present: 0,
      absent: 0,
      late: 0,
      leave: 0,
      halfDay: 0,
      excused: 0,
    };
    const byClass: Array<{
      sectionId: string;
      label: string;
      students: number;
      present: number;
      absent: number;
      late: number;
      leave: number;
      percent: number;
      status: string;
    }> = [];
    const absentees: Array<Record<string, unknown>> = [];
    const lateStudents: Array<Record<string, unknown>> = [];
    for (const sec of sections) {
      const sess = sessions.find((s) => s.sectionId === sec.id);
      const students = enrollMap.get(sec.id) ?? 0;
      totals.students += students;
      const counts = {
        present: 0,
        absent: 0,
        late: 0,
        leave: 0,
        halfDay: 0,
        excused: 0,
      };
      if (sess) {
        for (const r of sess.records) {
          if (r.statusCode === 'PRESENT') counts.present += 1;
          else if (r.statusCode === 'ABSENT') {
            counts.absent += 1;
            absentees.push({
              studentId: r.studentId,
              sectionId: sec.id,
              label: `${sec.grade.name} ${sec.name}`,
              status: r.statusCode,
              remark: r.remark,
            });
          } else if (r.statusCode === 'LATE') {
            counts.late += 1;
            lateStudents.push({
              studentId: r.studentId,
              sectionId: sec.id,
              label: `${sec.grade.name} ${sec.name}`,
            });
          } else if (r.statusCode === 'LEAVE') counts.leave += 1;
          else if (r.statusCode === 'HALF_DAY') counts.halfDay += 1;
          else if (r.statusCode === 'EXCUSED') counts.excused += 1;
        }
      }
      totals.present += counts.present;
      totals.absent += counts.absent;
      totals.late += counts.late;
      totals.leave += counts.leave;
      totals.halfDay += counts.halfDay;
      totals.excused += counts.excused;
      const marked = sess?.records.length ?? 0;
      let earned = 0;
      if (sess) {
        for (const r of sess.records)
          earned += unitForStatus(r.statusCode, settingsUnits(settings));
      }
      const pct = attendancePercent(earned, marked || students);
      byClass.push({
        sectionId: sec.id,
        label: `${sec.grade.name} ${sec.name}`,
        students,
        present: counts.present,
        absent: counts.absent,
        late: counts.late,
        leave: counts.leave,
        percent: marked ? pct : 0,
        status: sess ? this.effectiveStatus(sess, settings) : 'NOT_SUBMITTED',
      });
    }
    const submittedCount = byClass.filter(
      (c) => c.status !== 'NOT_SUBMITTED' && c.status !== 'DRAFT',
    ).length;
    const markedStudents =
      totals.present +
      totals.absent +
      totals.late +
      totals.leave +
      totals.halfDay +
      totals.excused;
    const overallEarned =
      totals.present +
      (settings.lateCountsPresent ? totals.late : 0) +
      (settings.leaveCountsPresent ? totals.leave : 0) +
      (settings.excusedCountsPresent ? totals.excused : 0) +
      totals.halfDay * Number(settings.halfDayValue);
    const overallPct = attendancePercent(
      overallEarned,
      markedStudents || totals.students,
    );

    const from = parseDay(date);
    from.setUTCDate(from.getUTCDate() - 13);
    const trendSessions = await this.prisma.schoolAttendanceSession.findMany({
      where: {
        tenantId,
        academicYearId: year.id,
        mode: 'DAILY',
        date: { gte: from, lte: parseDay(date) },
        status: { in: ['SUBMITTED', 'LOCKED'] },
        ...(sectionIds.length ? { sectionId: { in: sectionIds } } : {}),
      },
      include: { records: true },
    });
    const trendMap = new Map<string, { earned: number; total: number }>();
    for (const s of trendSessions) {
      const k = dayKey(s.date);
      const cur = trendMap.get(k) ?? { earned: 0, total: 0 };
      for (const r of s.records) {
        cur.total += 1;
        cur.earned += unitForStatus(r.statusCode, settingsUnits(settings));
      }
      trendMap.set(k, cur);
    }
    const trend = [...trendMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, v]) => ({
        name,
        value: attendancePercent(v.earned, v.total),
      }));

    const low = await this.lowAttendance(tenantId, {
      academicYearId: year.id,
      sectionIds: q.sectionIds ?? undefined,
      limit: 12,
    });

    return {
      academicYear: { id: year.id, name: year.name },
      date,
      dayKind: holiday.kind,
      settings: presentSettings(settings),
      totals: { ...totals, percent: overallPct },
      completion: {
        submitted: submittedCount,
        total: sections.length,
        missing: byClass.filter(
          (c) => c.status === 'NOT_SUBMITTED' || c.status === 'DRAFT',
        ),
      },
      byClass,
      absentees,
      lateStudents,
      trend,
      lowAttendance: low.rows,
    };
  }

  async roster(
    tenantId: string,
    q: {
      academicYearId?: string;
      date: string;
      sectionId: string;
      mode?: string;
      periodKey?: string;
    },
    actor: AttendanceActor,
  ) {
    const year = await this.year(tenantId, q.academicYearId);
    const settings = await this.ensureSetup(tenantId, year.id);
    const date = dayKey(q.date);
    const rule = await this.resolveClassRule(tenantId, year.id, q.sectionId);
    const allowedMode = rule?.mode || settings.mode || 'DAILY';
    const mode = q.mode || (allowedMode === 'PERIOD' ? 'PERIOD' : 'DAILY');
    const periodKey = q.periodKey || 'DAILY';
    if (mode === 'PERIOD' && allowedMode === 'DAILY') {
      throw new BadRequestException(
        'Period attendance is not enabled for this class.',
      );
    }
    if (mode === 'DAILY' && allowedMode === 'PERIOD') {
      throw new BadRequestException('This class uses period attendance only.');
    }
    const day = await this.calendar.resolveDay(tenantId, date, year.id);
    const section = await this.prisma.schoolSection.findFirst({
      where: { id: q.sectionId, tenantId, deletedAt: null },
      include: {
        grade: true,
        classTeachers: { where: { deletedAt: null }, include: { staff: true } },
      },
    });
    if (!section) throw new NotFoundException('Section not found');
    const enrolls = await this.enrollments(tenantId, year.id, section.id);
    const session = await this.prisma.schoolAttendanceSession.findUnique({
      where: {
        tenantId_academicYearId_date_sectionId_mode_periodKey: {
          tenantId,
          academicYearId: year.id,
          date: parseDay(date),
          sectionId: section.id,
          mode,
          periodKey,
        },
      },
      include: {
        records: true,
        staff: { select: { id: true, fullName: true } },
      },
    });
    const approvedLeave = await this.prisma.schoolAttendanceLeave.findMany({
      where: {
        tenantId,
        status: 'APPROVED',
        studentId: { in: enrolls.map((e) => e.studentId) },
        fromDate: { lte: parseDay(date) },
        toDate: { gte: parseDay(date) },
      },
    });
    const leaveSet = new Set(approvedLeave.map((l) => l.studentId));
    const recMap = new Map(session?.records.map((r) => [r.studentId, r]) ?? []);
    const defaultCode =
      settings.defaultMarking === 'BLANK' ? '' : settings.defaultStatus;
    const students = enrolls.map((e) => {
      const rec = recMap.get(e.studentId);
      const parent = e.student.guardians[0]?.guardian;
      const status =
        rec?.statusCode ??
        (leaveSet.has(e.studentId) ? 'LEAVE' : defaultCode || 'PRESENT');
      return {
        studentId: e.studentId,
        fullName: e.student.fullName,
        admissionNumber: e.student.admissionNumber,
        rollNumber: e.rollNumber,
        photoUrl: e.student.photoUrl,
        parentName: parent?.fullName ?? null,
        parentPhone: parent?.phone ?? null,
        status,
        remark: rec?.remark ?? null,
        markedAt: rec?.markedAt ?? null,
        recordId: rec?.id ?? null,
        version: rec?.version ?? 0,
        onApprovedLeave: leaveSet.has(e.studentId),
      };
    });
    const counts = {
      present: 0,
      absent: 0,
      late: 0,
      leave: 0,
      halfDay: 0,
      excused: 0,
    };
    for (const s of students) {
      if (s.status === 'PRESENT') counts.present += 1;
      else if (s.status === 'ABSENT') counts.absent += 1;
      else if (s.status === 'LATE') counts.late += 1;
      else if (s.status === 'LEAVE') counts.leave += 1;
      else if (s.status === 'HALF_DAY') counts.halfDay += 1;
      else if (s.status === 'EXCUSED') counts.excused += 1;
    }
    return {
      academicYear: { id: year.id, name: year.name },
      date,
      dayKind: day.kind,
      holidayBlocked: !this.calendar.isWorkingKind(
        day.kind,
        policyFromSettingsRow(settings),
      ),
      attendanceEnabled: policyFromSettingsRow(settings).enabled,
      section: {
        id: section.id,
        name: `${section.grade.name} ${section.name}`,
        gradeId: section.gradeId,
        classTeacher: section.classTeachers[0]?.staff.fullName ?? null,
      },
      settings: presentSettings(settings),
      session: session
        ? {
            id: session.id,
            status: this.effectiveStatus(session, settings),
            version: session.version,
            submittedAt: session.submittedAt,
            source: session.source,
            markedBy: session.staff?.fullName ?? null,
            lockedAt: session.lockedAt,
          }
        : null,
      counts,
      students,
      canEdit: this.canEdit(
        actor,
        session ? this.effectiveStatus(session, settings) : 'DRAFT',
        settings,
      ),
    };
  }

  private canEdit(
    actor: AttendanceActor,
    status: string,
    settings: {
      correctionRequired: boolean;
      policy?: unknown;
      lateCountsPresent?: boolean;
    },
  ) {
    const policy = policyFromSettingsRow(settings);
    if (!policy.enabled) return false;
    if (actor.manage || actor.canLock) return true;
    if (!policy.allowEditing) return status === 'DRAFT';
    if (status === 'LOCKED') return false;
    if (status === 'SUBMITTED' || status === 'CORRECTION_REQUESTED') {
      return policy.teacherCanEditSubmitted;
    }
    return true;
  }

  async saveRoster(
    tenantId: string,
    dto: SubmitAttendanceDto,
    actor: AttendanceActor,
    asDraft = true,
  ) {
    const year = await this.year(tenantId, dto.academicYearId);
    const settings = await this.ensureSetup(tenantId, year.id);
    const policy = policyFromSettingsRow(settings);
    if (!policy.enabled) {
      throw new BadRequestException('Student attendance is disabled.');
    }
    const date = dayKey(dto.date);
    if (!asDraft)
      await this.assertWorkingDay(tenantId, date, year.id, settings);
    else {
      const yearRow = await this.year(tenantId, year.id);
      const d = parseDay(date);
      if (d < parseDay(yearRow.startDate) || d > parseDay(yearRow.endDate)) {
        throw new BadRequestException(
          'Attendance date is outside the academic year.',
        );
      }
    }
    const rule = await this.resolveClassRule(tenantId, year.id, dto.sectionId);
    const allowedMode = rule?.mode || settings.mode || 'DAILY';
    const mode = dto.mode || (allowedMode === 'PERIOD' ? 'PERIOD' : 'DAILY');
    const periodKey = dto.periodKey || 'DAILY';
    if (mode === 'PERIOD' && allowedMode === 'DAILY') {
      throw new BadRequestException(
        'Period attendance is not enabled for this class.',
      );
    }
    if (mode === 'DAILY' && allowedMode === 'PERIOD') {
      throw new BadRequestException('This class uses period attendance only.');
    }
    const enrolls = await this.enrollments(tenantId, year.id, dto.sectionId);
    const allowed = new Set(enrolls.map((e) => e.studentId));
    for (const row of dto.records) {
      if (!allowed.has(row.studentId)) {
        throw new BadRequestException(
          'This student is not enrolled in this section.',
        );
      }
    }
    if (
      settings.geoEnabled &&
      dto.geoLat != null &&
      dto.geoLng != null &&
      settings.geoLat &&
      settings.geoLng
    ) {
      const dist = this.haversine(
        Number(settings.geoLat),
        Number(settings.geoLng),
        dto.geoLat,
        dto.geoLng,
      );
      if (dist > settings.geoRadiusM) {
        throw new BadRequestException(
          `Device is outside the allowed attendance radius (${settings.geoRadiusM} m).`,
        );
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.schoolAttendanceSession.findUnique({
        where: {
          tenantId_academicYearId_date_sectionId_mode_periodKey: {
            tenantId,
            academicYearId: year.id,
            date: parseDay(date),
            sectionId: dto.sectionId,
            mode,
            periodKey,
          },
        },
        include: { records: true },
      });
      if (
        existing &&
        dto.clientSessionId &&
        existing.clientSessionId &&
        existing.clientSessionId !== dto.clientSessionId
      ) {
        // same natural key, different client — treat as same session (idempotent)
      }
      if (dto.clientSessionId) {
        const byClient = await tx.schoolAttendanceSession.findFirst({
          where: { tenantId, clientSessionId: dto.clientSessionId },
          include: { records: true },
        });
        if (byClient && existing && byClient.id !== existing.id) {
          throw new ConflictException(
            'Client session id already used for another attendance session.',
          );
        }
      }
      const statusNow = existing
        ? this.effectiveStatus(existing, settings)
        : 'DRAFT';
      if (!this.canEdit(actor, statusNow, settings) && !asDraft) {
        throw new ForbiddenException(
          'Attendance is locked. Submit a correction request.',
        );
      }
      if (statusNow === 'LOCKED' && !actor.manage && !actor.canLock) {
        throw new ForbiddenException('Attendance is locked.');
      }
      if (
        existing &&
        dto.baseVersion != null &&
        dto.baseVersion !== existing.version &&
        !asDraft
      ) {
        return {
          conflict: true,
          message: 'Attendance conflict detected.',
          serverVersion: existing.version,
          original: existing.records.map((r) => ({
            studentId: r.studentId,
            status: r.statusCode,
          })),
          incoming: dto.records.map((r) => ({
            studentId: r.studentId,
            status: r.statusCode,
          })),
          sessionId: existing.id,
        };
      }
      const staff = await tx.schoolPersonAccount.findFirst({
        where: { tenantId, userId: actor.userId, personType: 'STAFF' },
      });
      const session = existing
        ? await tx.schoolAttendanceSession.update({
            where: { id: existing.id },
            data: {
              staffId: staff?.staffId ?? existing.staffId,
              source: dto.source ?? existing.source,
              deviceId: dto.deviceId,
              geoLat: dto.geoLat,
              geoLng: dto.geoLng,
              subjectId: dto.subjectId ?? existing.subjectId,
              clientSessionId: dto.clientSessionId ?? existing.clientSessionId,
              version: asDraft ? existing.version : existing.version + 1,
              status: asDraft
                ? existing.status === 'SUBMITTED' ||
                  existing.status === 'LOCKED'
                  ? existing.status
                  : 'DRAFT'
                : 'SUBMITTED',
              submittedAt: asDraft ? existing.submittedAt : new Date(),
              submittedBy: asDraft ? existing.submittedBy : actor.userId,
            },
          })
        : await tx.schoolAttendanceSession.create({
            data: {
              tenantId,
              academicYearId: year.id,
              date: parseDay(date),
              sectionId: dto.sectionId,
              mode,
              periodKey,
              subjectId: dto.subjectId,
              staffId: staff?.staffId,
              source: dto.source ?? (dto.deviceId ? 'MOBILE' : 'MANUAL'),
              deviceId: dto.deviceId,
              clientSessionId: dto.clientSessionId,
              geoLat: dto.geoLat,
              geoLng: dto.geoLng,
              status: asDraft ? 'DRAFT' : 'SUBMITTED',
              submittedAt: asDraft ? null : new Date(),
              submittedBy: asDraft ? null : actor.userId,
              version: 1,
            },
          });

      const prev = new Map(
        (existing?.records ?? []).map((r) => [r.studentId, r]),
      );
      const incomingIds = new Set(dto.records.map((r) => r.studentId));
      const defaultCode = settings.defaultStatus || 'PRESENT';
      const rows =
        dto.records.length === enrolls.length
          ? dto.records
          : enrolls.map(
              (e) =>
                dto.records.find((r) => r.studentId === e.studentId) ?? {
                  studentId: e.studentId,
                  statusCode: prev.get(e.studentId)?.statusCode ?? defaultCode,
                  remark: prev.get(e.studentId)?.remark ?? undefined,
                },
            );
      void incomingIds;

      for (const row of rows) {
        const old = prev.get(row.studentId);
        if (row.clientRecordId) {
          const dup = await tx.schoolAttendanceRecord.findFirst({
            where: { tenantId, clientRecordId: row.clientRecordId },
          });
          if (dup && dup.sessionId !== session.id) {
            throw new ConflictException(
              'Duplicate client attendance identifier.',
            );
          }
        }
        const rec = await tx.schoolAttendanceRecord.upsert({
          where: {
            sessionId_studentId: {
              sessionId: session.id,
              studentId: row.studentId,
            },
          },
          create: {
            tenantId,
            sessionId: session.id,
            studentId: row.studentId,
            statusCode: row.statusCode.toUpperCase(),
            remark: row.remark,
            markedAt: new Date(),
            markedBy: actor.userId,
            source: dto.source ?? 'MANUAL',
            deviceId: dto.deviceId,
            clientRecordId: row.clientRecordId,
          },
          update: {
            statusCode: row.statusCode.toUpperCase(),
            remark: row.remark,
            markedAt: new Date(),
            markedBy: actor.userId,
            version: { increment: 1 },
            source: dto.source ?? old?.source ?? 'MANUAL',
          },
        });
        if (!old || old.statusCode !== row.statusCode.toUpperCase()) {
          await tx.schoolAttendanceAudit.create({
            data: {
              tenantId,
              recordId: rec.id,
              sessionId: session.id,
              studentId: row.studentId,
              actorId: actor.userId,
              action: asDraft ? 'DRAFT_MARK' : old ? 'UPDATED' : 'CREATED',
              oldStatus: old?.statusCode,
              newStatus: row.statusCode.toUpperCase(),
              ipAddress: actor.ip,
              deviceId: dto.deviceId ?? actor.deviceId,
            },
          });
        }
        if (dto.deviceId && row.clientRecordId) {
          await tx.schoolAttendanceSyncItem.upsert({
            where: {
              tenantId_clientRecordId: {
                tenantId,
                clientRecordId: row.clientRecordId,
              },
            },
            create: {
              tenantId,
              deviceId: dto.deviceId,
              clientRecordId: row.clientRecordId,
              serverRecordId: rec.id,
              serverSessionId: session.id,
              syncStatus: 'SYNCED',
              syncedAt: new Date(),
            },
            update: {
              serverRecordId: rec.id,
              serverSessionId: session.id,
              syncStatus: 'SYNCED',
              syncedAt: new Date(),
            },
          });
        }
      }

      await tx.schoolAttendanceAudit.create({
        data: {
          tenantId,
          sessionId: session.id,
          actorId: actor.userId,
          action: asDraft ? 'SAVED_DRAFT' : 'SUBMITTED',
          ipAddress: actor.ip,
          deviceId: dto.deviceId ?? actor.deviceId,
        },
      });

      return {
        conflict: false,
        sessionId: session.id,
        status: asDraft ? 'DRAFT' : 'SUBMITTED',
      };
    });
    if (!asDraft && result && 'sessionId' in result && !result.conflict) {
      await this.afterSubmit(tenantId, result.sessionId, actor);
    }
    return result;
  }

  private haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371000;
    const toRad = (n: number) => (n * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  private async afterSubmit(
    tenantId: string,
    sessionId: string,
    actor: AttendanceActor,
  ) {
    const session = await this.prisma.schoolAttendanceSession.findFirst({
      where: { id: sessionId, tenantId },
      include: {
        records: {
          include: { student: { select: { id: true, fullName: true } } },
        },
        section: { include: { grade: true } },
      },
    });
    if (!session) return;
    const settings = await this.ensureSetup(tenantId, session.academicYearId);
    const policy = policyFromSettingsRow(settings);
    const channels = notifyChannels(policy);
    const date = dayKey(session.date);
    const className = `${session.section.grade.name} ${session.section.name}`;
    await this.events.publish({
      event: 'attendance.submitted',
      tenantId,
      entityType: 'attendance_session',
      entityId: session.id,
      data: {
        date,
        class_name: className,
        section: session.section.name,
        channels,
      },
    });
    for (const rec of session.records) {
      if (
        rec.statusCode === 'ABSENT' &&
        settings.absentNotify &&
        anyNotifyChannel(policy)
      ) {
        await this.recordNotify(
          tenantId,
          `absent:${rec.studentId}:${date}:${session.id}`,
          'ABSENT',
          rec.studentId,
          session.id,
        );
        await this.events.publish({
          event: 'attendance.absent',
          tenantId,
          studentId: rec.studentId,
          entityType: 'attendance_record',
          entityId: rec.id,
          data: {
            student_name: rec.student.fullName,
            attendance_date: date,
            class_name: className,
            section: session.section.name,
            channels,
          },
        });
      }
      if (
        rec.statusCode === 'LATE' &&
        settings.lateNotify &&
        anyNotifyChannel(policy)
      ) {
        await this.recordNotify(
          tenantId,
          `late:${rec.studentId}:${date}:${session.id}`,
          'LATE',
          rec.studentId,
          session.id,
        );
        await this.events.publish({
          event: 'attendance.late',
          tenantId,
          studentId: rec.studentId,
          entityType: 'attendance_record',
          entityId: rec.id,
          data: {
            student_name: rec.student.fullName,
            attendance_date: date,
            class_name: className,
            channels,
          },
        });
      }
      if (rec.statusCode !== 'ABSENT') {
        await this.prisma.schoolAttendanceNotifyEvent.updateMany({
          where: {
            tenantId,
            studentId: rec.studentId,
            eventType: 'ABSENT',
            eventKey: { startsWith: `absent:${rec.studentId}:${date}` },
            superseded: false,
          },
          data: { superseded: true },
        });
      }
      if (rec.statusCode === 'ABSENT') {
        const streak = await this.consecutiveAbsences(
          tenantId,
          rec.studentId,
          session.academicYearId,
          session.sectionId,
          parseDay(date),
        );
        if (
          streak >= settings.consecutiveAbsentAlert &&
          policy.notifyRepeatedAbsence &&
          anyNotifyChannel(policy)
        ) {
          await this.events.publish({
            event: 'attendance.consecutive_absent',
            tenantId,
            studentId: rec.studentId,
            entityId: rec.id,
            data: {
              student_name: rec.student.fullName,
              class_name: className,
              consecutive_days: streak,
              channels,
            },
          });
        }
      }
    }
    void actor;
  }

  private async consecutiveAbsences(
    tenantId: string,
    studentId: string,
    academicYearId: string,
    sectionId: string,
    end: Date,
  ) {
    const from = new Date(end);
    from.setUTCDate(from.getUTCDate() - 21);
    const settings = await this.ensureSetup(tenantId, academicYearId);
    const policy = policyFromSettingsRow(settings);
    const recs = await this.prisma.schoolAttendanceRecord.findMany({
      where: {
        tenantId,
        studentId,
        voided: false,
        session: {
          academicYearId,
          sectionId,
          mode: 'DAILY',
          status: { in: ['SUBMITTED', 'LOCKED'] },
          date: { gte: from, lte: end },
        },
      },
      include: { session: { select: { date: true } } },
    });
    const byDate = new Map(
      recs.map((r) => [dayKey(r.session.date), r.statusCode]),
    );
    let streak = 0;
    for (
      let d = new Date(end);
      d >= from;
      d = new Date(d.getTime() - 86400000)
    ) {
      const kind = await this.calendar.resolveDay(
        tenantId,
        dayKey(d),
        academicYearId,
      );
      if (!this.calendar.isWorkingKind(kind.kind, policy)) continue;
      const st = byDate.get(dayKey(d));
      if (st === 'ABSENT') streak += 1;
      else break;
    }
    return streak;
  }

  private async recordNotify(
    tenantId: string,
    eventKey: string,
    eventType: string,
    studentId: string,
    sessionId?: string,
  ) {
    try {
      await this.prisma.schoolAttendanceNotifyEvent.create({
        data: { tenantId, eventKey, eventType, studentId, sessionId },
      });
      return true;
    } catch {
      return false;
    }
  }

  async submitExisting(
    tenantId: string,
    sessionId: string,
    actor: AttendanceActor,
  ) {
    const session = await this.prisma.schoolAttendanceSession.findFirst({
      where: { id: sessionId, tenantId },
      include: { records: true },
    });
    if (!session) throw new NotFoundException('Attendance session not found');
    const settings = await this.ensureSetup(tenantId, session.academicYearId);
    const status = this.effectiveStatus(session, settings);
    if (status === 'LOCKED' && !actor.canLock && !actor.manage) {
      throw new ForbiddenException('Attendance is locked.');
    }
    await this.assertWorkingDay(
      tenantId,
      dayKey(session.date),
      session.academicYearId,
      settings,
    );
    await this.prisma.schoolAttendanceSession.update({
      where: { id: sessionId },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        submittedBy: actor.userId,
        version: { increment: 1 },
      },
    });
    await this.prisma.schoolAttendanceAudit.create({
      data: {
        tenantId,
        sessionId,
        actorId: actor.userId,
        action: 'SUBMITTED',
        ipAddress: actor.ip,
      },
    });
    await this.afterSubmit(tenantId, sessionId, actor);
    return { ok: true, status: 'SUBMITTED' };
  }

  async lock(
    tenantId: string,
    sessionId: string,
    actor: AttendanceActor,
    unlock?: UnlockAttendanceDto,
  ) {
    const session = await this.prisma.schoolAttendanceSession.findFirst({
      where: { id: sessionId, tenantId },
    });
    if (!session) throw new NotFoundException('Attendance session not found');
    const settings = await this.ensureSetup(tenantId, session.academicYearId);
    const policy = policyFromSettingsRow(settings);
    if (unlock) {
      if (!actor.canLock && !actor.manage)
        throw new ForbiddenException('Not allowed to unlock attendance');
      if (!policy.adminCanUnlock && !actor.manage)
        throw new ForbiddenException(
          'Unlock is disabled in attendance settings.',
        );
      await this.prisma.schoolAttendanceSession.update({
        where: { id: sessionId },
        data: {
          status: 'SUBMITTED',
          lockedAt: null,
          unlockedAt: new Date(),
          unlockedBy: actor.userId,
          unlockReason: unlock.reason,
        },
      });
      await this.prisma.schoolAttendanceAudit.create({
        data: {
          tenantId,
          sessionId,
          actorId: actor.userId,
          action: 'UNLOCKED',
          reason: unlock.reason,
          ipAddress: actor.ip,
        },
      });
      return { ok: true, status: 'SUBMITTED' };
    }
    await this.prisma.schoolAttendanceSession.update({
      where: { id: sessionId },
      data: { status: 'LOCKED', lockedAt: new Date(), lockedBy: actor.userId },
    });
    await this.prisma.schoolAttendanceAudit.create({
      data: {
        tenantId,
        sessionId,
        actorId: actor.userId,
        action: 'LOCKED',
        ipAddress: actor.ip,
      },
    });
    return { ok: true, status: 'LOCKED' };
  }

  async requestCorrection(
    tenantId: string,
    dto: AttendanceCorrectionDto,
    actor: AttendanceActor,
  ) {
    const rec = await this.prisma.schoolAttendanceRecord.findFirst({
      where: { id: dto.recordId, tenantId },
      include: { session: true },
    });
    if (!rec) throw new NotFoundException('Attendance record not found');
    const settings = await this.ensureSetup(
      tenantId,
      rec.session.academicYearId,
    );
    const policy = policyFromSettingsRow(settings);
    if (!policy.allowCorrections) {
      throw new BadRequestException('Attendance corrections are disabled.');
    }
    if (policy.correctionReasonRequired && !dto.reason?.trim()) {
      throw new BadRequestException('A reason is required for corrections.');
    }
    if (policy.correctionWindowDays > 0) {
      const age =
        (Date.now() - parseDay(dayKey(rec.session.date)).getTime()) /
        86_400_000;
      if (age > policy.correctionWindowDays) {
        throw new BadRequestException(
          `Corrections are only allowed within ${policy.correctionWindowDays} day(s).`,
        );
      }
    }
    const row = await this.prisma.schoolAttendanceCorrection.create({
      data: {
        tenantId,
        sessionId: rec.sessionId,
        recordId: rec.id,
        studentId: rec.studentId,
        fromStatus: rec.statusCode,
        toStatus: dto.toStatus.toUpperCase(),
        reason: dto.reason,
        submittedBy: actor.userId,
      },
    });
    await this.prisma.schoolAttendanceSession.update({
      where: { id: rec.sessionId },
      data: {
        status:
          rec.session.status === 'LOCKED'
            ? 'CORRECTION_REQUESTED'
            : rec.session.status,
      },
    });
    await this.prisma.schoolAttendanceAudit.create({
      data: {
        tenantId,
        recordId: rec.id,
        sessionId: rec.sessionId,
        studentId: rec.studentId,
        actorId: actor.userId,
        action: 'CORRECTION_REQUESTED',
        oldStatus: rec.statusCode,
        newStatus: dto.toStatus.toUpperCase(),
        reason: dto.reason,
      },
    });
    if (policy.notifyCorrection && anyNotifyChannel(policy)) {
      await this.events.publish({
        event: 'attendance.correction.requested',
        tenantId,
        studentId: rec.studentId,
        entityId: row.id,
        data: {
          from: rec.statusCode,
          to: dto.toStatus,
          channels: notifyChannels(policy),
        },
      });
    }
    return row;
  }

  async listCorrections(
    tenantId: string,
    status?: string,
    sectionIds?: string[] | null,
  ) {
    return this.prisma.schoolAttendanceCorrection.findMany({
      where: {
        tenantId,
        ...(status ? { status } : {}),
        ...(sectionIds ? { session: { sectionId: { in: sectionIds } } } : {}),
      },
      include: {
        student: { select: { fullName: true, admissionNumber: true } },
        session: { include: { section: { include: { grade: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async reviewCorrection(
    tenantId: string,
    id: string,
    actor: AttendanceActor,
    approve: boolean,
    note?: string,
  ) {
    if (!actor.canApprove && !actor.manage)
      throw new ForbiddenException('Not allowed to approve corrections');
    const row = await this.prisma.schoolAttendanceCorrection.findFirst({
      where: { id, tenantId },
      include: { record: true },
    });
    if (!row) throw new NotFoundException('Correction not found');
    if (row.status !== 'PENDING')
      throw new BadRequestException('Correction already reviewed');
    await this.prisma.$transaction(async (tx) => {
      await tx.schoolAttendanceCorrection.update({
        where: { id },
        data: {
          status: approve ? 'APPROVED' : 'REJECTED',
          reviewedBy: actor.userId,
          reviewedAt: new Date(),
          reviewNote: note,
        },
      });
      if (approve) {
        await tx.schoolAttendanceRecord.update({
          where: { id: row.recordId },
          data: { statusCode: row.toStatus, version: { increment: 1 } },
        });
      }
      await tx.schoolAttendanceAudit.create({
        data: {
          tenantId,
          recordId: row.recordId,
          sessionId: row.sessionId,
          studentId: row.studentId,
          actorId: actor.userId,
          action: approve ? 'CORRECTION_APPROVED' : 'CORRECTION_REJECTED',
          oldStatus: row.fromStatus,
          newStatus: row.toStatus,
          reason: note ?? row.reason,
        },
      });
    });
    await this.events.publish({
      event: approve
        ? 'attendance.correction.approved'
        : 'attendance.correction.rejected',
      tenantId,
      studentId: row.studentId,
      entityId: id,
    });
    return { ok: true };
  }

  async createLeave(
    tenantId: string,
    dto: CreateLeaveDto,
    actor: AttendanceActor,
  ) {
    await this.ensureSetup(tenantId);
    const student = await this.prisma.schoolStudent.findFirst({
      where: { id: dto.studentId, tenantId, deletedAt: null },
    });
    if (!student) throw new NotFoundException('Student not found');
    return this.prisma.schoolAttendanceLeave.create({
      data: {
        tenantId,
        studentId: dto.studentId,
        leaveTypeId: dto.leaveTypeId,
        fromDate: parseDay(dto.fromDate),
        toDate: parseDay(dto.toDate),
        reason: dto.reason,
        documentUrl: dto.documentUrl,
        submittedBy: actor.userId,
      },
    });
  }

  async listLeaves(tenantId: string, status?: string, studentId?: string) {
    return this.prisma.schoolAttendanceLeave.findMany({
      where: {
        tenantId,
        ...(status ? { status } : {}),
        ...(studentId ? { studentId } : {}),
      },
      include: {
        student: { select: { fullName: true, admissionNumber: true } },
        leaveType: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async reviewLeave(
    tenantId: string,
    id: string,
    actor: AttendanceActor,
    approve: boolean,
    note?: string,
  ) {
    if (!actor.canApprove && !actor.manage)
      throw new ForbiddenException('Not allowed to approve leave');
    const row = await this.prisma.schoolAttendanceLeave.findFirst({
      where: { id, tenantId },
      include: { leaveType: true, student: true },
    });
    if (!row) throw new NotFoundException('Leave request not found');
    await this.prisma.schoolAttendanceLeave.update({
      where: { id },
      data: {
        status: approve ? 'APPROVED' : 'REJECTED',
        approvedBy: actor.userId,
        approvedAt: new Date(),
        rejectReason: approve ? null : note,
      },
    });
    if (approve) {
      await this.applyApprovedLeave(tenantId, row);
    }
    await this.prisma.schoolAttendanceAudit.create({
      data: {
        tenantId,
        studentId: row.studentId,
        actorId: actor.userId,
        action: approve ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
        reason: note,
      },
    });
    await this.events.publish({
      event: approve
        ? 'attendance.leave.approved'
        : 'attendance.leave.rejected',
      tenantId,
      studentId: row.studentId,
      entityId: id,
      data: { student_name: row.student.fullName },
    });
    return { ok: true };
  }

  private async applyApprovedLeave(
    tenantId: string,
    leave: { studentId: string; fromDate: Date; toDate: Date },
  ) {
    const enroll = await this.prisma.schoolEnrollment.findFirst({
      where: {
        tenantId,
        studentId: leave.studentId,
        status: 'ACTIVE',
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!enroll) return;
    const sessions = await this.prisma.schoolAttendanceSession.findMany({
      where: {
        tenantId,
        sectionId: enroll.sectionId,
        date: { gte: leave.fromDate, lte: leave.toDate },
        mode: 'DAILY',
      },
    });
    for (const s of sessions) {
      const rec = await this.prisma.schoolAttendanceRecord.findUnique({
        where: {
          sessionId_studentId: { sessionId: s.id, studentId: leave.studentId },
        },
      });
      if (rec && rec.statusCode === 'ABSENT') {
        await this.prisma.schoolAttendanceRecord.update({
          where: { id: rec.id },
          data: { statusCode: 'LEAVE' },
        });
        await this.prisma.schoolAttendanceAudit.create({
          data: {
            tenantId,
            recordId: rec.id,
            sessionId: s.id,
            studentId: leave.studentId,
            action: 'LEAVE_APPLIED',
            oldStatus: 'ABSENT',
            newStatus: 'LEAVE',
          },
        });
      }
    }
  }

  async absentees(
    tenantId: string,
    q: {
      date?: string;
      academicYearId?: string;
      sectionIds?: string[] | null;
      status?: string;
    },
  ) {
    const year = await this.year(tenantId, q.academicYearId);
    const date = q.date ? dayKey(q.date) : istDayKey();
    const codes = q.status ? [q.status] : ['ABSENT', 'LATE', 'LEAVE'];
    const rows = await this.prisma.schoolAttendanceRecord.findMany({
      where: {
        tenantId,
        voided: false,
        statusCode: { in: codes },
        session: {
          academicYearId: year.id,
          date: parseDay(date),
          mode: 'DAILY',
          ...(q.sectionIds ? { sectionId: { in: q.sectionIds } } : {}),
        },
      },
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            admissionNumber: true,
            photoUrl: true,
            phone: true,
            guardians: {
              include: {
                guardian: { select: { fullName: true, phone: true } },
              },
            },
          },
        },
        session: { include: { section: { include: { grade: true } } } },
      },
      orderBy: { student: { fullName: 'asc' } },
    });
    return rows.map((r) => ({
      recordId: r.id,
      studentId: r.studentId,
      fullName: r.student.fullName,
      admissionNumber: r.student.admissionNumber,
      photoUrl: r.student.photoUrl,
      className: `${r.session.section.grade.name} ${r.session.section.name}`,
      sectionId: r.session.sectionId,
      status: r.statusCode,
      remark: r.remark,
      parentName: r.student.guardians[0]?.guardian.fullName ?? null,
      parentPhone: r.student.guardians[0]?.guardian.phone ?? r.student.phone,
    }));
  }

  async lowAttendance(
    tenantId: string,
    q: {
      academicYearId?: string;
      sectionIds?: string[] | null;
      below?: number;
      limit?: number;
    },
  ) {
    const year = await this.year(tenantId, q.academicYearId);
    const settings = await this.ensureSetup(tenantId, year.id);
    const threshold = q.below ?? settings.minPercent;
    const working = await this.workingDays(
      tenantId,
      dayKey(year.startDate),
      istDayKey(),
      year.id,
      settings,
    );
    const enrolls = await this.prisma.schoolEnrollment.findMany({
      where: {
        tenantId,
        academicYearId: year.id,
        status: 'ACTIVE',
        deletedAt: null,
        ...(q.sectionIds ? { sectionId: { in: q.sectionIds } } : {}),
      },
      include: {
        student: {
          select: { id: true, fullName: true, admissionNumber: true },
        },
        section: { include: { grade: true } },
      },
    });
    const records = await this.prisma.schoolAttendanceRecord.findMany({
      where: {
        tenantId,
        studentId: { in: enrolls.map((e) => e.studentId) },
        voided: false,
        session: {
          academicYearId: year.id,
          mode: 'DAILY',
          status: { in: ['SUBMITTED', 'LOCKED'] },
        },
      },
      select: { studentId: true, statusCode: true },
    });
    const byStu = new Map<
      string,
      { earned: number; total: number; absent: number }
    >();
    for (const r of records) {
      const cur = byStu.get(r.studentId) ?? { earned: 0, total: 0, absent: 0 };
      cur.total += 1;
      cur.earned += unitForStatus(r.statusCode, settingsUnits(settings));
      if (r.statusCode === 'ABSENT') cur.absent += 1;
      byStu.set(r.studentId, cur);
    }
    const rows = enrolls
      .map((e) => {
        const s = byStu.get(e.studentId) ?? { earned: 0, total: 0, absent: 0 };
        const days = s.total || working.working;
        const pct = attendancePercent(s.earned, days);
        return {
          studentId: e.studentId,
          fullName: e.student.fullName,
          admissionNumber: e.student.admissionNumber,
          className: `${e.section.grade.name} ${e.section.name}`,
          workingDays: days,
          presentUnits: s.earned,
          absent: s.absent,
          percent: pct,
          band: bandForPercent(pct, settings.warnPercent, settings.minPercent),
        };
      })
      .filter((r) => r.percent < threshold && r.workingDays > 0)
      .sort((a, b) => a.percent - b.percent);
    return {
      threshold,
      workingDays: working.working,
      rows: rows.slice(0, q.limit ?? 500),
    };
  }

  async monthly(
    tenantId: string,
    q: { academicYearId?: string; sectionId: string; month: string },
  ) {
    const year = await this.year(tenantId, q.academicYearId);
    const settings = await this.ensureSetup(tenantId, year.id);
    const [y, m] = q.month.split('-').map(Number);
    const from = new Date(Date.UTC(y, m - 1, 1));
    const to = new Date(Date.UTC(y, m, 0));
    const working = await this.workingDays(
      tenantId,
      dayKey(from),
      dayKey(to),
      year.id,
      settings,
    );
    const enrolls = await this.enrollments(tenantId, year.id, q.sectionId);
    const sessions = await this.prisma.schoolAttendanceSession.findMany({
      where: {
        tenantId,
        academicYearId: year.id,
        sectionId: q.sectionId,
        mode: 'DAILY',
        date: { gte: from, lte: to },
        status: { in: ['SUBMITTED', 'LOCKED'] },
      },
      include: { records: true },
    });
    const byStudent = new Map<string, Record<string, string>>();
    const stats = new Map<
      string,
      {
        present: number;
        absent: number;
        late: number;
        leave: number;
        half: number;
        earned: number;
      }
    >();
    for (const s of sessions) {
      const dk = dayKey(s.date);
      for (const r of s.records) {
        const days = byStudent.get(r.studentId) ?? {};
        days[dk] = r.statusCode;
        byStudent.set(r.studentId, days);
        const st = stats.get(r.studentId) ?? {
          present: 0,
          absent: 0,
          late: 0,
          leave: 0,
          half: 0,
          earned: 0,
        };
        if (r.statusCode === 'PRESENT') st.present += 1;
        else if (r.statusCode === 'ABSENT') st.absent += 1;
        else if (r.statusCode === 'LATE') st.late += 1;
        else if (r.statusCode === 'LEAVE') st.leave += 1;
        else if (r.statusCode === 'HALF_DAY') st.half += 1;
        st.earned += unitForStatus(r.statusCode, settingsUnits(settings));
        stats.set(r.studentId, st);
      }
    }
    const days: string[] = [];
    for (let d = new Date(from); d <= to; d = new Date(d.getTime() + 86400000))
      days.push(dayKey(d));
    return {
      month: q.month,
      workingDays: working.working,
      days,
      students: enrolls.map((e) => {
        const st = stats.get(e.studentId) ?? {
          present: 0,
          absent: 0,
          late: 0,
          leave: 0,
          half: 0,
          earned: 0,
        };
        const grid = byStudent.get(e.studentId) ?? {};
        return {
          studentId: e.studentId,
          fullName: e.student.fullName,
          rollNumber: e.rollNumber,
          admissionNumber: e.student.admissionNumber,
          ...st,
          percent: attendancePercent(st.earned, working.working),
          letters: Object.fromEntries(
            Object.entries(grid).map(([k, v]) => [
              k,
              REGISTER_LETTER[v] ?? v.slice(0, 2),
            ]),
          ),
        };
      }),
    };
  }

  async studentProfile(
    tenantId: string,
    studentId: string,
    academicYearId?: string,
  ) {
    const year = await this.year(tenantId, academicYearId);
    const settings = await this.ensureSetup(tenantId, year.id);
    const enroll = await this.prisma.schoolEnrollment.findFirst({
      where: { tenantId, studentId, academicYearId: year.id, deletedAt: null },
      include: { section: { include: { grade: true } }, student: true },
    });
    if (!enroll)
      throw new NotFoundException(
        'Enrollment not found for this academic year',
      );
    const monthly = await this.monthly(tenantId, {
      academicYearId: year.id,
      sectionId: enroll.sectionId,
      month: istDayKey().slice(0, 7),
    });
    const me = monthly.students.find((s) => s.studentId === studentId);
    const yearWorking = await this.workingDays(
      tenantId,
      dayKey(year.startDate),
      istDayKey() > dayKey(year.endDate) ? dayKey(year.endDate) : istDayKey(),
      year.id,
      settings,
    );
    const recs = await this.prisma.schoolAttendanceRecord.findMany({
      where: {
        tenantId,
        studentId,
        voided: false,
        session: {
          academicYearId: year.id,
          mode: 'DAILY',
          status: { in: ['SUBMITTED', 'LOCKED'] },
        },
      },
      include: { session: true },
      orderBy: { session: { date: 'desc' } },
      take: 366,
    });
    let earned = 0;
    const history = recs.map((r) => {
      earned += unitForStatus(r.statusCode, settingsUnits(settings));
      return {
        date: dayKey(r.session.date),
        status: r.statusCode,
        remark: r.remark,
        letter: REGISTER_LETTER[r.statusCode] ?? r.statusCode,
      };
    });
    const pct = attendancePercent(earned, yearWorking.working);
    return {
      student: {
        id: enroll.student.id,
        fullName: enroll.student.fullName,
        admissionNumber: enroll.student.admissionNumber,
        className: `${enroll.section.grade.name} ${enroll.section.name}`,
      },
      academicYear: { id: year.id, name: year.name },
      workingDays: yearWorking.working,
      percent: pct,
      band: bandForPercent(pct, settings.warnPercent, settings.minPercent),
      status: attendanceStatusLabel(
        pct,
        settings.warnPercent,
        settings.minPercent,
        policyFromSettingsRow(settings).goodPercent,
      ),
      month: me,
      calendar: history,
    };
  }

  async searchStudents(
    tenantId: string,
    q: string,
    academicYearId?: string,
    sectionIds?: string[] | null,
  ) {
    const year = await this.year(tenantId, academicYearId);
    const term = q.trim();
    if (term.length < 2) return [];
    return this.prisma.schoolEnrollment.findMany({
      where: {
        tenantId,
        academicYearId: year.id,
        status: 'ACTIVE',
        deletedAt: null,
        ...(sectionIds ? { sectionId: { in: sectionIds } } : {}),
        OR: [
          { rollNumber: { contains: term, mode: 'insensitive' } },
          { student: { fullName: { contains: term, mode: 'insensitive' } } },
          {
            student: {
              admissionNumber: { contains: term, mode: 'insensitive' },
            },
          },
        ],
      },
      include: { student: true, section: { include: { grade: true } } },
      take: 30,
    });
  }

  async teacherToday(tenantId: string, userId: string, date?: string) {
    const year = await this.sis.currentYear(tenantId);
    const settings = await this.ensureSetup(tenantId, year.id);
    const day = date ? dayKey(date) : istDayKey();
    const jsDay = parseDay(day).getUTCDay();
    const staffId = await resolveSchoolStaffIdForUser(this.prisma, tenantId, {
      sub: userId,
    });
    const slots = staffId
      ? await this.prisma.schoolTimetableSlot.findMany({
          where: {
            tenantId,
            staffId,
            dayOfWeek: jsDay === 0 ? 7 : jsDay,
            plan: { academicYearId: year.id },
          },
          include: {
            section: { include: { grade: true } },
            subject: true,
            bell: true,
          },
          orderBy: { bell: { sortOrder: 'asc' } },
        })
      : [];
    const classTeacher = staffId
      ? await this.prisma.schoolClassTeacherAssignment.findMany({
          where: {
            tenantId,
            staffId,
            academicYearId: year.id,
            deletedAt: null,
          },
          include: { section: { include: { grade: true } } },
        })
      : [];
    const subs = staffId
      ? await this.prisma.schoolAttendanceSubstitute.findMany({
          where: { tenantId, staffId, date: parseDay(day) },
          include: { section: { include: { grade: true } } },
        })
      : [];
    const sessions = await this.prisma.schoolAttendanceSession.findMany({
      where: {
        tenantId,
        academicYearId: year.id,
        date: parseDay(day),
        mode: 'DAILY',
      },
    });
    const sessMap = new Map(sessions.map((s) => [s.sectionId, s]));
    const classRows = new Map<
      string,
      { sectionId: string; label: string; status: string }
    >();
    for (const c of [
      ...classTeacher,
      ...subs.map((x) => ({ section: x.section })),
    ]) {
      classRows.set(c.section.id, {
        sectionId: c.section.id,
        label: `${c.section.grade.name} ${c.section.name}`,
        status: sessMap.get(c.section.id)?.status ?? 'NOT_SUBMITTED',
      });
    }
    for (const s of slots) {
      if (classRows.has(s.sectionId)) continue;
      classRows.set(s.sectionId, {
        sectionId: s.sectionId,
        label: `${s.section.grade.name} ${s.section.name}`,
        status: sessMap.get(s.sectionId)?.status ?? 'NOT_SUBMITTED',
      });
    }
    return {
      date: day,
      settings: presentSettings(settings),
      periods: slots.map((s) => ({
        sectionId: s.sectionId,
        label: `${s.section.grade.name} ${s.section.name}`,
        subject: s.subject?.name ?? s.printedSubject,
        start: s.bell.startTime,
        periodKey: s.bellId,
        submitted: sessMap.get(s.sectionId)?.status,
      })),
      classes: [...classRows.values()],
    };
  }

  async assignSubstitute(
    tenantId: string,
    dto: SubstituteDto,
    actor: AttendanceActor,
  ) {
    if (!actor.manage)
      throw new ForbiddenException(
        'Only administrators can assign substitutes',
      );
    return this.prisma.schoolAttendanceSubstitute.create({
      data: {
        tenantId,
        sectionId: dto.sectionId,
        date: parseDay(dto.date),
        staffId: dto.staffId,
        originalStaffId: dto.originalStaffId,
        reason: dto.reason,
        createdBy: actor.userId,
      },
    });
  }

  async generateQr(tenantId: string, sessionId: string) {
    const settings = await this.ensureSetup(tenantId);
    if (!settings.qrEnabled)
      throw new BadRequestException('QR attendance is not enabled.');
    const token = randomBytes(16).toString('hex');
    const hash = createHash('sha256').update(token).digest('hex');
    await this.prisma.schoolAttendanceSession.update({
      where: { id: sessionId },
      data: { qrToken: hash, qrExpiresAt: new Date(Date.now() + 10 * 60_000) },
    });
    return { token, expiresInSec: 600 };
  }

  async scanQr(tenantId: string, dto: QrScanDto, actor: AttendanceActor) {
    const hash = createHash('sha256').update(dto.token).digest('hex');
    const session = await this.prisma.schoolAttendanceSession.findFirst({
      where: { tenantId, qrToken: hash },
    });
    if (!session) throw new BadRequestException('Invalid QR code.');
    if (!session.qrExpiresAt || session.qrExpiresAt < new Date()) {
      throw new BadRequestException('QR code has expired.');
    }
    const enroll = await this.prisma.schoolEnrollment.findFirst({
      where: {
        tenantId,
        studentId: dto.studentId,
        sectionId: session.sectionId,
        academicYearId: session.academicYearId,
        status: 'ACTIVE',
        deletedAt: null,
      },
    });
    if (!enroll) throw new ForbiddenException('Student is not in this class.');
    await this.prisma.schoolAttendanceRecord.upsert({
      where: {
        sessionId_studentId: {
          sessionId: session.id,
          studentId: dto.studentId,
        },
      },
      create: {
        tenantId,
        sessionId: session.id,
        studentId: dto.studentId,
        statusCode: 'PRESENT',
        source: 'QR',
        markedAt: new Date(),
        markedBy: actor.userId,
      },
      update: {},
    });
    return { ok: true };
  }

  async syncOffline(
    tenantId: string,
    dto: AttendanceSyncDto,
    actor: AttendanceActor,
  ) {
    const results = [];
    for (const sess of dto.sessions) {
      const r = await this.saveRoster(
        tenantId,
        { ...sess, deviceId: dto.deviceId, source: sess.source ?? 'MOBILE' },
        actor,
        sess.asDraft ?? false,
      );
      results.push(r);
    }
    return { results };
  }

  async bulkNotify(tenantId: string, dto: BulkNotifyDto) {
    for (const studentId of dto.studentIds) {
      const key = `bulk:${dto.channel ?? 'PUSH'}:${studentId}:${istDayKey()}:${createHash(
        'sha1',
      )
        .update(dto.message ?? 'absent')
        .digest('hex')
        .slice(0, 8)}`;
      const fresh = await this.recordNotify(tenantId, key, 'BULK', studentId);
      if (!fresh) continue;
      await this.events.publish({
        event: 'attendance.notify.parent',
        tenantId,
        studentId,
        data: { channel: dto.channel ?? 'PUSH', message: dto.message },
      });
    }
    return { queued: dto.studentIds.length };
  }

  async parentChildren(tenantId: string, userId: string) {
    const account = await this.prisma.schoolPersonAccount.findFirst({
      where: { tenantId, userId, personType: { in: ['GUARDIAN', 'STUDENT'] } },
    });
    if (!account) return [];
    if (account.personType === 'STUDENT' && account.studentId) {
      return [await this.studentProfile(tenantId, account.studentId)];
    }
    if (!account.guardianId) return [];
    const links = await this.prisma.schoolStudentGuardian.findMany({
      where: { guardianId: account.guardianId },
      select: { studentId: true },
    });
    const out = [];
    for (const l of links) {
      try {
        out.push(await this.studentProfile(tenantId, l.studentId));
      } catch {
        /* not enrolled in current year */
      }
    }
    return out;
  }

  private reportDateRange(filters: {
    dateFrom?: string;
    dateTo?: string;
    month?: string;
  }) {
    if (filters.month && /^\d{4}-\d{2}$/.test(filters.month)) {
      const [y, m] = filters.month.split('-').map(Number);
      return {
        from: `${filters.month}-01`,
        to: dayKey(new Date(Date.UTC(y, m, 0))),
      };
    }
    const to = (filters.dateTo || istDayKey()).slice(0, 10);
    const from = (filters.dateFrom || `${to.slice(0, 7)}-01`).slice(0, 10);
    return from <= to ? { from, to } : { from: to, to: from };
  }

  async rangeAnalytics(
    tenantId: string,
    filters: {
      academicYearId?: string;
      sectionId?: string;
      gradeId?: string;
      dateFrom?: string;
      dateTo?: string;
      month?: string;
      studentId?: string;
      subjectId?: string;
    },
  ) {
    const year = await this.year(tenantId, filters.academicYearId);
    const settings = await this.ensureSetup(tenantId, year.id);
    const { from, to } = this.reportDateRange(filters);
    const sections = await this.prisma.schoolSection.findMany({
      where: {
        tenantId,
        academicYearId: year.id,
        deletedAt: null,
        active: true,
        ...(filters.gradeId ? { gradeId: filters.gradeId } : {}),
        ...(filters.sectionId ? { id: filters.sectionId } : {}),
      },
      include: { grade: { select: { id: true, name: true, sortOrder: true } } },
      orderBy: [{ grade: { sortOrder: 'asc' } }, { name: 'asc' }],
    });
    const sectionIds = sections.map((s) => s.id);
    const sectionMap = new Map(sections.map((s) => [s.id, s]));
    const enrolls = sectionIds.length
      ? await this.prisma.schoolEnrollment.findMany({
          where: {
            tenantId,
            academicYearId: year.id,
            status: 'ACTIVE',
            deletedAt: null,
            sectionId: { in: sectionIds },
            ...(filters.studentId ? { studentId: filters.studentId } : {}),
            student: { deletedAt: null, status: 'ACTIVE' },
          },
          include: {
            student: {
              select: { id: true, fullName: true, admissionNumber: true },
            },
          },
          orderBy: [{ rollNumber: 'asc' }, { student: { fullName: 'asc' } }],
          take: 8000,
        })
      : [];
    const working = await this.workingDays(
      tenantId,
      from,
      to,
      year.id,
      settings,
    );
    const sessions = sectionIds.length
      ? await this.prisma.schoolAttendanceSession.findMany({
          where: {
            tenantId,
            academicYearId: year.id,
            date: { gte: parseDay(from), lte: parseDay(to) },
            sectionId: { in: sectionIds },
            status: { in: ['SUBMITTED', 'LOCKED'] },
            ...(filters.subjectId
              ? { mode: 'PERIOD', subjectId: filters.subjectId }
              : { mode: 'DAILY', periodKey: 'DAILY' }),
          },
          include: { records: { where: { voided: false } } },
        })
      : [];
    type Counts = {
      present: number;
      absent: number;
      late: number;
      leave: number;
      half: number;
      earned: number;
      marked: number;
    };
    const emptyCounts = (): Counts => ({
      present: 0,
      absent: 0,
      late: 0,
      leave: 0,
      half: 0,
      earned: 0,
      marked: 0,
    });
    const bump = (st: Counts, code: string) => {
      if (code === 'PRESENT') st.present += 1;
      else if (code === 'ABSENT') st.absent += 1;
      else if (code === 'LATE') st.late += 1;
      else if (code === 'LEAVE') st.leave += 1;
      else if (code === 'HALF_DAY') st.half += 1;
      st.earned += unitForStatus(code, settingsUnits(settings));
      st.marked += 1;
    };
    const byStudent = new Map<string, Counts>();
    const byClass = new Map<string, Counts>();
    const byDay = new Map<string, Counts>();
    const lastStatus = new Map<string, { date: string; status: string }>();
    for (const session of sessions) {
      const dk = dayKey(session.date);
      const classCounts = byClass.get(session.sectionId) ?? emptyCounts();
      const dayCounts = byDay.get(dk) ?? emptyCounts();
      for (const rec of session.records) {
        if (filters.studentId && rec.studentId !== filters.studentId) continue;
        const st = byStudent.get(rec.studentId) ?? emptyCounts();
        bump(st, rec.statusCode);
        bump(classCounts, rec.statusCode);
        bump(dayCounts, rec.statusCode);
        byStudent.set(rec.studentId, st);
        const prev = lastStatus.get(rec.studentId);
        if (!prev || dk >= prev.date) {
          lastStatus.set(rec.studentId, { date: dk, status: rec.statusCode });
        }
      }
      byClass.set(session.sectionId, classCounts);
      byDay.set(dk, dayCounts);
    }
    const workingDays = Math.max(1, working.working);
    const students = enrolls.map((e) => {
      const st = byStudent.get(e.studentId) ?? emptyCounts();
      const sec = sectionMap.get(e.sectionId);
      const percent = attendancePercent(st.earned, workingDays);
      return {
        studentId: e.studentId,
        admissionNumber: e.student.admissionNumber,
        fullName: e.student.fullName,
        className: sec?.grade.name ?? '',
        sectionName: sec?.name ?? '',
        classLabel: sec ? `${sec.grade.name} ${sec.name}` : '',
        totalDays: working.working,
        present: st.present,
        absent: st.absent,
        late: st.late,
        leave: st.leave,
        percent,
        status: attendanceStatusLabel(
          percent,
          settings.warnPercent,
          settings.minPercent,
          policyFromSettingsRow(settings).goodPercent,
        ),
        band: bandForPercent(
          percent,
          settings.warnPercent,
          settings.minPercent,
        ),
      };
    });
    const classRows = sections.map((sec) => {
      const st = byClass.get(sec.id) ?? emptyCounts();
      const headcount = enrolls.filter((e) => e.sectionId === sec.id).length;
      const percent = attendancePercent(st.earned, Math.max(1, st.marked));
      return {
        sectionId: sec.id,
        label: `${sec.grade.name} ${sec.name}`,
        className: sec.grade.name,
        sectionName: sec.name,
        students: headcount,
        present: st.present,
        absent: st.absent,
        late: st.late,
        leave: st.leave,
        percent: st.marked ? percent : 0,
      };
    });
    const series: Array<{
      name: string;
      present: number;
      absent: number;
      late: number;
      leave: number;
    }> = [];
    for (
      let d = parseDay(from);
      d <= parseDay(to);
      d = new Date(d.getTime() + 86_400_000)
    ) {
      const dk = dayKey(d);
      const st = byDay.get(dk) ?? emptyCounts();
      series.push({
        name: dk.slice(8),
        present: st.present,
        absent: st.absent,
        late: st.late,
        leave: st.leave,
      });
      if (series.length >= 45) break;
    }
    const unique = { present: 0, absent: 0, late: 0, leave: 0 };
    for (const enroll of enrolls) {
      const last = lastStatus.get(enroll.studentId)?.status;
      if (last === 'ABSENT') unique.absent += 1;
      else if (last === 'LATE') unique.late += 1;
      else if (last === 'LEAVE' || last === 'EXCUSED') unique.leave += 1;
      else if (last === 'HALF_DAY') unique.present += 1;
      else if (last) unique.present += 1;
    }
    const uniquePct = (n: number) =>
      Math.round((n / Math.max(1, enrolls.length)) * 1000) / 10;
    const summary = {
      students: enrolls.length,
      present: unique.present,
      absent: unique.absent,
      late: unique.late,
      leave: unique.leave,
      presentPct: uniquePct(unique.present),
      absentPct: uniquePct(unique.absent),
      latePct: uniquePct(unique.late),
      leavePct: uniquePct(unique.leave),
      workingDays: working.working,
    };
    const kpis = [
      { key: 'students', label: 'Total Students', value: summary.students },
      { key: 'present', label: 'Present', value: summary.present },
      { key: 'absent', label: 'Absent', value: summary.absent },
      { key: 'late', label: 'Late', value: summary.late },
      { key: 'leave', label: 'Leave', value: summary.leave },
      { key: 'presentPct', label: 'Present %', value: summary.presentPct },
      { key: 'absentPct', label: 'Absent %', value: summary.absentPct },
      { key: 'latePct', label: 'Late %', value: summary.latePct },
      { key: 'leavePct', label: 'Leave %', value: summary.leavePct },
    ];
    return {
      from,
      to,
      year,
      settings: presentSettings(settings),
      summary,
      kpis,
      series,
      students,
      classRows,
      charts: [
        {
          type: 'bar' as const,
          title: 'Attendance Overview',
          data: series.map((d) => ({ name: d.name, value: d.present })),
        },
      ],
    };
  }

  async reportBundle(
    tenantId: string,
    key: string,
    filters: {
      academicYearId?: string;
      sectionId?: string;
      gradeId?: string;
      dateFrom?: string;
      dateTo?: string;
      month?: string;
      studentId?: string;
      status?: string;
      subjectId?: string;
    },
  ) {
    const year = await this.year(tenantId, filters.academicYearId);
    const settings = await this.ensureSetup(tenantId, year.id);
    const date = filters.dateFrom || istDayKey();
    const studentListKeys = new Set([
      'attendance_daily',
      'attendance_range',
      'attendance_student',
      'attendance_subject',
      'attendance_percent',
      'attendance_monthly',
      'attendance_absentees',
      'attendance_absentees_daily',
      'attendance_absentees_monthly',
      'attendance_low',
      'attendance_chronic',
      'attendance_defaulters',
      'attendance_late',
    ]);
    const classListKeys = new Set([
      'attendance_class',
      'attendance_section',
      'attendance_class_compare',
      'attendance_section_compare',
      'attendance_trend',
    ]);
    if (studentListKeys.has(key) || classListKeys.has(key)) {
      const analytics = await this.rangeAnalytics(tenantId, filters);
      const studentColumns = [
        { key: 'admissionNumber', label: 'Admission No' },
        { key: 'fullName', label: 'Student Name' },
        { key: 'className', label: 'Class' },
        { key: 'sectionName', label: 'Section' },
        { key: 'totalDays', label: 'Total Days' },
        { key: 'present', label: 'Present' },
        { key: 'absent', label: 'Absent' },
        { key: 'late', label: 'Late' },
        { key: 'leave', label: 'Leave' },
        { key: 'percent', label: 'Attendance %' },
        { key: 'status', label: 'Status' },
      ];
      let students = analytics.students;
      if (
        key === 'attendance_absentees' ||
        key === 'attendance_absentees_monthly'
      ) {
        students = students.filter((s) => s.absent > 0);
      }
      if (key === 'attendance_absentees_daily') {
        students = students.filter((s) => s.absent > 0);
      }
      if (key === 'attendance_late') {
        students = students.filter((s) => s.late > 0);
      }
      if (
        key === 'attendance_low' ||
        key === 'attendance_chronic' ||
        key === 'attendance_defaulters'
      ) {
        students = students.filter((s) => s.percent < settings.minPercent);
      }
      if (classListKeys.has(key)) {
        const trendSeries =
          key === 'attendance_trend'
            ? analytics.series
            : analytics.classRows.map((c) => ({
                name: c.label,
                present: c.present,
                absent: c.absent,
                late: c.late,
                leave: c.leave,
              }));
        return {
          columns: [
            { key: 'label', label: 'Class' },
            { key: 'students', label: 'Students' },
            { key: 'present', label: 'Present' },
            { key: 'absent', label: 'Absent' },
            { key: 'late', label: 'Late' },
            { key: 'leave', label: 'Leave' },
            { key: 'percent', label: '%' },
          ],
          rows: analytics.classRows,
          kpis: analytics.kpis,
          charts: analytics.charts,
          series: trendSeries,
          summary: analytics.summary,
        };
      }
      return {
        columns: studentColumns,
        rows: students,
        kpis: analytics.kpis,
        charts: analytics.charts,
        series: analytics.series,
        summary: analytics.summary,
      };
    }
    if (
      key === 'attendance_register' ||
      key === 'attendance_monthly_register'
    ) {
      if (!filters.sectionId) {
        const analytics = await this.rangeAnalytics(tenantId, filters);
        return {
          columns: [
            { key: 'label', label: 'Class' },
            { key: 'percent', label: '%' },
            { key: 'present', label: 'Present' },
            { key: 'absent', label: 'Absent' },
          ],
          rows: analytics.classRows,
          kpis: analytics.kpis,
          charts: analytics.charts,
          series: analytics.series,
          summary: analytics.summary,
        };
      }
      const month = filters.month || date.slice(0, 7);
      const monthly = await this.monthly(tenantId, {
        academicYearId: year.id,
        sectionId: filters.sectionId,
        month,
      });
      if (key === 'attendance_register') {
        const dayCols = monthly.days.map((d) => ({
          key: d,
          label: d.slice(8),
        }));
        return {
          columns: [
            { key: 'fullName', label: 'Student' },
            { key: 'rollNumber', label: 'Roll' },
            ...dayCols,
            { key: 'percent', label: '%' },
          ],
          rows: monthly.students.map((s) => ({
            fullName: s.fullName,
            rollNumber: s.rollNumber,
            percent: s.percent,
            ...s.letters,
          })),
          kpis: [
            { key: 'wd', label: 'Working days', value: monthly.workingDays },
          ],
        };
      }
      return {
        columns: [
          { key: 'fullName', label: 'Student' },
          { key: 'present', label: 'Present' },
          { key: 'absent', label: 'Absent' },
          { key: 'late', label: 'Late' },
          { key: 'leave', label: 'Leave' },
          { key: 'percent', label: '%' },
        ],
        rows: monthly.students.map((s) => ({
          fullName: s.fullName,
          present: s.present,
          absent: s.absent,
          late: s.late,
          leave: s.leave,
          percent: s.percent,
        })),
        kpis: [
          { key: 'wd', label: 'Working days', value: monthly.workingDays },
        ],
      };
    }
    if (key === 'attendance_leave') {
      const leaves = await this.listLeaves(tenantId);
      return {
        columns: [
          { key: 'student', label: 'Student' },
          { key: 'type', label: 'Type' },
          { key: 'from', label: 'From' },
          { key: 'to', label: 'To' },
          { key: 'status', label: 'Status' },
        ],
        rows: leaves.map((l) => ({
          student: l.student.fullName,
          type: l.leaveType.name,
          from: dayKey(l.fromDate),
          to: dayKey(l.toDate),
          status: l.status,
        })),
        kpis: [{ key: 'n', label: 'Leave requests', value: leaves.length }],
      };
    }
    if (key === 'attendance_teacher') {
      const dash = await this.dashboard(tenantId, {
        academicYearId: year.id,
        date,
      });
      return {
        columns: [
          { key: 'label', label: 'Class' },
          { key: 'status', label: 'Submission' },
          { key: 'students', label: 'Students' },
        ],
        rows: dash.byClass.map((c) => ({
          label: c.label,
          status: c.status,
          students: c.students,
        })),
        kpis: [
          { key: 'done', label: 'Submitted', value: dash.completion.submitted },
          { key: 'total', label: 'Classes', value: dash.completion.total },
        ],
      };
    }
    const analytics = await this.rangeAnalytics(tenantId, filters);
    return {
      columns: [
        { key: 'admissionNumber', label: 'Admission No' },
        { key: 'fullName', label: 'Student Name' },
        { key: 'className', label: 'Class' },
        { key: 'sectionName', label: 'Section' },
        { key: 'totalDays', label: 'Total Days' },
        { key: 'present', label: 'Present' },
        { key: 'absent', label: 'Absent' },
        { key: 'late', label: 'Late' },
        { key: 'leave', label: 'Leave' },
        { key: 'percent', label: 'Attendance %' },
        { key: 'status', label: 'Status' },
      ],
      rows: analytics.students,
      kpis: analytics.kpis,
      charts: analytics.charts,
      series: analytics.series,
      summary: analytics.summary,
    };
  }

  async history(tenantId: string, sessionId: string) {
    return this.prisma.schoolAttendanceAudit.findMany({
      where: { tenantId, sessionId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
}
