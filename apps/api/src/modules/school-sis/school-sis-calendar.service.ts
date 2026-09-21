import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { SchoolSisService } from './school-sis.service';
import { SchoolSisPushService } from './school-sis-push.service';
import { SchoolSisEventBus } from './school-sis-event-bus.service';
import {
  DEFAULT_EVENT_CATEGORIES,
  DEFAULT_HOLIDAY_TYPES,
} from './school-sis-calendar.catalog';
import type {
  ImportHolidaysDto,
  SaveAcademicTermDto,
  SaveCalendarEventDto,
  SaveHolidayDto,
  SaveHolidayTypeDto,
  SaveOverrideDto,
  SaveWeeklyOffDto,
} from './dto/school-calendar.dto';

export type CalendarActor = { userId: string; manage: boolean };

export type DayKind =
  | 'WORKING_DAY'
  | 'WEEKLY_OFF'
  | 'HOLIDAY'
  | 'VACATION'
  | 'SPECIAL_WORKING_DAY'
  | 'EXAMINATION';

export type WorkingDayPolicy = {
  countHolidaysAsWorking?: boolean;
  countWeeklyOffAsWorking?: boolean;
  countExamAsWorking?: boolean;
  countEventsAsWorking?: boolean;
};

function dayKey(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

function parseDay(value: string | Date) {
  const s = typeof value === 'string' ? value.slice(0, 10) : dayKey(value);
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

function eachDay(start: Date, end: Date) {
  const out: Date[] = [];
  let cur = parseDay(start);
  const last = parseDay(end);
  while (cur <= last) {
    out.push(new Date(cur));
    cur = addDays(cur, 1);
  }
  return out;
}

function weekOfMonth(d: Date) {
  return Math.ceil(d.getUTCDate() / 7);
}

@Injectable()
export class SchoolSisCalendarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sis: SchoolSisService,
    private readonly push: SchoolSisPushService,
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

  private assertManage(actor: CalendarActor) {
    if (!actor.manage)
      throw new ForbiddenException('Not allowed to change the school calendar');
  }

  private async audit(
    tenantId: string,
    actor: CalendarActor,
    action: string,
    recordId?: string,
    oldValue?: unknown,
    newValue?: unknown,
    reason?: string,
  ) {
    await this.prisma.schoolCalendarAuditLog.create({
      data: {
        tenantId,
        userId: actor.userId,
        action,
        recordId,
        reason,
        oldValue:
          oldValue == null
            ? undefined
            : (JSON.parse(JSON.stringify(oldValue)) as Prisma.InputJsonValue),
        newValue:
          newValue == null
            ? undefined
            : (JSON.parse(JSON.stringify(newValue)) as Prisma.InputJsonValue),
      },
    });
  }

  async ensureSetup(tenantId: string, academicYearId?: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const year = await this.year(tenantId, academicYearId);
    const typeCount = await this.prisma.schoolHolidayType.count({
      where: { tenantId, deletedAt: null },
    });
    if (typeCount === 0) {
      let i = 0;
      for (const t of DEFAULT_HOLIDAY_TYPES) {
        await this.prisma.schoolHolidayType.create({
          data: {
            tenantId,
            code: t.code,
            name: t.name,
            kind: t.kind,
            sortOrder: i++,
          },
        });
      }
    }
    const catCount = await this.prisma.schoolCalendarEventCategory.count({
      where: { tenantId, deletedAt: null },
    });
    if (catCount === 0) {
      let i = 0;
      for (const c of DEFAULT_EVENT_CATEGORIES) {
        await this.prisma.schoolCalendarEventCategory.create({
          data: {
            tenantId,
            code: c.code,
            name: c.name,
            color: c.color,
            icon: c.icon,
            sortOrder: i++,
          },
        });
      }
    }
    await this.prisma.schoolWeeklyOffSetting.upsert({
      where: { tenantId_academicYearId: { tenantId, academicYearId: year.id } },
      update: {},
      create: { tenantId, academicYearId: year.id, weekdays: [0] },
    });
    const termCount = await this.prisma.schoolAcademicTerm.count({
      where: { tenantId, academicYearId: year.id },
    });
    if (termCount === 0) {
      await this.prisma.schoolAcademicTerm.createMany({
        data: [
          { tenantId, academicYearId: year.id, name: 'Term I', sortOrder: 0 },
          { tenantId, academicYearId: year.id, name: 'Term II', sortOrder: 1 },
        ],
      });
    }
    return year;
  }

  async setup(tenantId: string, academicYearId?: string) {
    const year = await this.ensureSetup(tenantId, academicYearId);
    const [types, categories, weekly, terms, years] = await Promise.all([
      this.prisma.schoolHolidayType.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.schoolCalendarEventCategory.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.schoolWeeklyOffSetting.findUnique({
        where: {
          tenantId_academicYearId: { tenantId, academicYearId: year.id },
        },
      }),
      this.prisma.schoolAcademicTerm.findMany({
        where: { tenantId, academicYearId: year.id },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.schoolAcademicYear.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: { startDate: 'desc' },
      }),
    ]);
    return { year, years, types, categories, weekly, terms };
  }

  async saveWeeklyOff(
    tenantId: string,
    dto: SaveWeeklyOffDto,
    actor: CalendarActor,
  ) {
    this.assertManage(actor);
    const year = await this.ensureSetup(tenantId, dto.academicYearId);
    const row = await this.prisma.schoolWeeklyOffSetting.upsert({
      where: { tenantId_academicYearId: { tenantId, academicYearId: year.id } },
      update: {
        weekdays: (dto.weekdays ?? [0]) as Prisma.InputJsonValue,
        saturdayRule: dto.saturdayRule ?? 'NONE',
        customWeeks: (dto.customWeeks ?? []) as Prisma.InputJsonValue,
      },
      create: {
        tenantId,
        academicYearId: year.id,
        weekdays: (dto.weekdays ?? [0]) as Prisma.InputJsonValue,
        saturdayRule: dto.saturdayRule ?? 'NONE',
        customWeeks: (dto.customWeeks ?? []) as Prisma.InputJsonValue,
      },
    });
    await this.audit(tenantId, actor, 'WEEKLY_OFF_SAVED', row.id, null, row);
    return row;
  }

  async saveTerms(
    tenantId: string,
    academicYearId: string | undefined,
    terms: SaveAcademicTermDto[],
    actor: CalendarActor,
  ) {
    this.assertManage(actor);
    const year = await this.ensureSetup(tenantId, academicYearId);
    await this.prisma.$transaction(async (tx) => {
      await tx.schoolAcademicTerm.deleteMany({
        where: { tenantId, academicYearId: year.id },
      });
      let i = 0;
      for (const t of terms) {
        if (!t.name?.trim()) continue;
        await tx.schoolAcademicTerm.create({
          data: {
            tenantId,
            academicYearId: year.id,
            name: t.name.trim(),
            sortOrder: t.sortOrder ?? i,
            startDate: t.startDate ? parseDay(t.startDate) : null,
            endDate: t.endDate ? parseDay(t.endDate) : null,
          },
        });
        i += 1;
      }
    });
    return this.setup(tenantId, year.id);
  }

  async saveHolidayType(
    tenantId: string,
    dto: SaveHolidayTypeDto,
    actor: CalendarActor,
  ) {
    this.assertManage(actor);
    return this.prisma.schoolHolidayType.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        code: dto.code.trim().toUpperCase(),
        kind: dto.kind || 'OTHER',
      },
    });
  }

  private isWeeklyOff(
    date: Date,
    weekly: {
      weekdays: Prisma.JsonValue;
      saturdayRule: string;
      customWeeks: Prisma.JsonValue;
    },
  ) {
    const jsDay = date.getUTCDay();
    const days = Array.isArray(weekly.weekdays)
      ? (weekly.weekdays as number[])
      : [];
    if (jsDay === 6) {
      const rule = weekly.saturdayRule || 'NONE';
      const nth = weekOfMonth(date);
      const custom = Array.isArray(weekly.customWeeks)
        ? (weekly.customWeeks as number[])
        : [];
      if (rule === 'EVERY' || (rule === 'NONE' && days.includes(6)))
        return true;
      if (rule === 'FIRST_THIRD') return nth === 1 || nth === 3;
      if (rule === 'SECOND_FOURTH') return nth === 2 || nth === 4;
      if (rule === 'ALTERNATE') return nth % 2 === 1;
      if (rule === 'CUSTOM') return custom.includes(nth);
      return false;
    }
    return days.includes(jsDay);
  }

  async resolveDay(
    tenantId: string,
    dateInput: string | Date,
    academicYearId?: string,
  ): Promise<{
    date: string;
    kind: DayKind;
    holidayId?: string;
    examId?: string;
    reason?: string;
  }> {
    const year = await this.ensureSetup(tenantId, academicYearId);
    const date = parseDay(dateInput);
    const key = dayKey(date);
    if (date < parseDay(year.startDate) || date > parseDay(year.endDate)) {
      return {
        date: key,
        kind: 'WORKING_DAY',
        reason: 'Outside academic year',
      };
    }
    const override = await this.prisma.schoolCalendarOverride.findFirst({
      where: {
        tenantId,
        academicYearId: year.id,
        date,
        kind: 'SPECIAL_WORKING_DAY',
        deletedAt: null,
      },
    });
    if (override) {
      return {
        date: key,
        kind: 'SPECIAL_WORKING_DAY',
        reason: override.reason ?? undefined,
      };
    }
    const holiday = await this.prisma.schoolHoliday.findFirst({
      where: {
        tenantId,
        academicYearId: year.id,
        deletedAt: null,
        status: 'ACTIVE',
        startDate: { lte: date },
        endDate: { gte: date },
      },
      include: { type: true },
    });
    if (holiday) {
      const kind = holiday.type.kind === 'VACATION' ? 'VACATION' : 'HOLIDAY';
      return { date: key, kind, holidayId: holiday.id };
    }
    const weekly = await this.prisma.schoolWeeklyOffSetting.findUnique({
      where: { tenantId_academicYearId: { tenantId, academicYearId: year.id } },
    });
    if (weekly && this.isWeeklyOff(date, weekly)) {
      return { date: key, kind: 'WEEKLY_OFF' };
    }
    const exam = await this.prisma.schoolExam.findFirst({
      where: {
        tenantId,
        academicYearId: year.id,
        deletedAt: null,
        startDate: { lte: date },
        endDate: { gte: date },
        status: { notIn: ['ARCHIVED', 'DRAFT'] },
      },
    });
    if (exam) return { date: key, kind: 'EXAMINATION', examId: exam.id };
    return { date: key, kind: 'WORKING_DAY' };
  }

  isWorkingKind(kind: DayKind, policy?: WorkingDayPolicy) {
    if (kind === 'WORKING_DAY') return true;
    if (kind === 'SPECIAL_WORKING_DAY')
      return policy?.countEventsAsWorking !== false;
    if (kind === 'EXAMINATION') return policy?.countExamAsWorking !== false;
    if (kind === 'HOLIDAY' || kind === 'VACATION')
      return policy?.countHolidaysAsWorking === true;
    if (kind === 'WEEKLY_OFF') return policy?.countWeeklyOffAsWorking === true;
    return false;
  }

  async workingDaysInRange(
    tenantId: string,
    from: string,
    to: string,
    academicYearId?: string,
    policy?: WorkingDayPolicy,
  ) {
    const days = eachDay(parseDay(from), parseDay(to));
    let working = 0;
    for (const d of days) {
      const r = await this.resolveDay(tenantId, d, academicYearId);
      if (this.isWorkingKind(r.kind, policy)) working += 1;
    }
    return { from, to, working, total: days.length };
  }

  private async loadYearMaps(tenantId: string, yearId: string) {
    const [holidays, overrides, weekly, exams] = await Promise.all([
      this.prisma.schoolHoliday.findMany({
        where: {
          tenantId,
          academicYearId: yearId,
          deletedAt: null,
          status: 'ACTIVE',
        },
        include: { type: true },
      }),
      this.prisma.schoolCalendarOverride.findMany({
        where: { tenantId, academicYearId: yearId, deletedAt: null },
      }),
      this.prisma.schoolWeeklyOffSetting.findUnique({
        where: {
          tenantId_academicYearId: { tenantId, academicYearId: yearId },
        },
      }),
      this.prisma.schoolExam.findMany({
        where: {
          tenantId,
          academicYearId: yearId,
          deletedAt: null,
          status: { notIn: ['ARCHIVED', 'DRAFT'] },
          startDate: { not: null },
        },
      }),
    ]);
    return { holidays, overrides, weekly, exams };
  }

  resolveFromMaps(
    date: Date,
    maps: Awaited<ReturnType<SchoolSisCalendarService['loadYearMaps']>>,
  ): DayKind {
    const key = dayKey(date);
    if (
      maps.overrides.some(
        (o) => dayKey(o.date) === key && o.kind === 'SPECIAL_WORKING_DAY',
      )
    ) {
      return 'SPECIAL_WORKING_DAY';
    }
    const holiday = maps.holidays.find(
      (h) => parseDay(h.startDate) <= date && parseDay(h.endDate) >= date,
    );
    if (holiday)
      return holiday.type.kind === 'VACATION' ? 'VACATION' : 'HOLIDAY';
    if (maps.weekly && this.isWeeklyOff(date, maps.weekly)) return 'WEEKLY_OFF';
    if (
      maps.exams.some(
        (e) =>
          e.startDate &&
          e.endDate &&
          parseDay(e.startDate) <= date &&
          parseDay(e.endDate) >= date,
      )
    ) {
      return 'EXAMINATION';
    }
    return 'WORKING_DAY';
  }

  async dashboard(tenantId: string, academicYearId?: string) {
    const year = await this.ensureSetup(tenantId, academicYearId);
    const maps = await this.loadYearMaps(tenantId, year.id);
    const days = eachDay(year.startDate, year.endDate);
    let working = 0;
    let vacationDays = 0;
    let holidayDays = 0;
    for (const d of days) {
      const kind = this.resolveFromMaps(d, maps);
      if (
        kind === 'WORKING_DAY' ||
        kind === 'SPECIAL_WORKING_DAY' ||
        kind === 'EXAMINATION'
      )
        working += 1;
      if (kind === 'VACATION') vacationDays += 1;
      if (kind === 'HOLIDAY') holidayDays += 1;
    }
    const gov = maps.holidays.filter(
      (h) => h.type.kind === 'GOVERNMENT',
    ).length;
    const school = maps.holidays.filter((h) => h.type.kind === 'SCHOOL').length;
    return {
      year,
      totalHolidays: maps.holidays.length,
      governmentHolidays: gov,
      schoolHolidays: school,
      vacationDays,
      holidayDays,
      workingDays: working,
    };
  }

  async monthGrid(
    tenantId: string,
    yearNum: number,
    month: number,
    academicYearId?: string,
  ) {
    const year = await this.ensureSetup(tenantId, academicYearId);
    const maps = await this.loadYearMaps(tenantId, year.id);
    const events = await this.prisma.schoolCalendarEvent.findMany({
      where: {
        tenantId,
        academicYearId: year.id,
        deletedAt: null,
        status: { not: 'CANCELLED' },
      },
      include: { category: true, holiday: true, exam: true },
    });
    const start = new Date(Date.UTC(yearNum, month - 1, 1));
    const end = new Date(Date.UTC(yearNum, month, 0));
    const cells = eachDay(start, end).map((d) => {
      const key = dayKey(d);
      const kind = this.resolveFromMaps(d, maps);
      const items = events.filter(
        (e) => parseDay(e.startDate) <= d && parseDay(e.endDate) >= d,
      );
      return { date: key, weekday: d.getUTCDay(), kind, items };
    });
    return { year, month, yearNum, cells };
  }

  async yearOverview(tenantId: string, academicYearId?: string) {
    const year = await this.ensureSetup(tenantId, academicYearId);
    const maps = await this.loadYearMaps(tenantId, year.id);
    const months: Array<{
      month: number;
      label: string;
      days: Array<{ date: string; kind: DayKind }>;
    }> = [];
    let cursor = parseDay(year.startDate);
    const last = parseDay(year.endDate);
    const labels = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    while (cursor <= last) {
      const m = cursor.getUTCMonth();
      const y = cursor.getUTCFullYear();
      const existing = months.find(
        (x) => x.month === m && x.label.endsWith(String(y)),
      );
      const bucket =
        existing ??
        (() => {
          const row = {
            month: m,
            label: `${labels[m]} ${y}`,
            days: [] as Array<{ date: string; kind: DayKind }>,
          };
          months.push(row);
          return row;
        })();
      bucket.days.push({
        date: dayKey(cursor),
        kind: this.resolveFromMaps(cursor, maps),
      });
      cursor = addDays(cursor, 1);
    }
    return { year, months };
  }

  async listHolidays(tenantId: string, academicYearId?: string) {
    const year = await this.ensureSetup(tenantId, academicYearId);
    return this.prisma.schoolHoliday.findMany({
      where: { tenantId, academicYearId: year.id, deletedAt: null },
      include: { type: true },
      orderBy: { startDate: 'asc' },
    });
  }

  private overlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
    return aStart <= bEnd && bStart <= aEnd;
  }

  async saveHoliday(
    tenantId: string,
    dto: SaveHolidayDto,
    actor: CalendarActor,
    id?: string,
  ) {
    this.assertManage(actor);
    const year = await this.ensureSetup(tenantId, dto.academicYearId);
    const start = parseDay(dto.startDate);
    const end = parseDay(dto.endDate || dto.startDate);
    if (end < start)
      throw new BadRequestException('End date cannot be before the start date');
    if (start < parseDay(year.startDate) || end > parseDay(year.endDate)) {
      throw new BadRequestException(
        'Holiday dates must fall within the academic year',
      );
    }
    const dup = await this.prisma.schoolHoliday.findFirst({
      where: {
        tenantId,
        academicYearId: year.id,
        deletedAt: null,
        name: dto.name.trim(),
        startDate: start,
        ...(id ? { NOT: { id } } : {}),
      },
    });
    if (dup)
      throw new BadRequestException(
        'This holiday already exists for the selected date',
      );
    const overlap = await this.prisma.schoolHoliday.findFirst({
      where: {
        tenantId,
        academicYearId: year.id,
        deletedAt: null,
        ...(id ? { NOT: { id } } : {}),
        startDate: { lte: end },
        endDate: { gte: start },
      },
    });
    if (overlap && !dto.overrideConflict) {
      throw new BadRequestException(
        `A holiday already exists on overlapping dates (${overlap.name}). Override to continue.`,
      );
    }
    const data = {
      name: dto.name.trim(),
      typeId: dto.typeId,
      startDate: start,
      endDate: end,
      appliesTo: dto.appliesTo || 'ALL',
      gradeIds: (dto.gradeIds ?? []) as Prisma.InputJsonValue,
      sectionIds: (dto.sectionIds ?? []) as Prisma.InputJsonValue,
      description: dto.description || null,
      recurring: dto.recurring ?? false,
      recurringRule: dto.recurringRule || null,
      updatedBy: actor.userId,
    };
    const row = id
      ? await this.prisma.schoolHoliday.update({
          where: { id },
          data,
          include: { type: true },
        })
      : await this.prisma.schoolHoliday.create({
          data: {
            tenantId,
            academicYearId: year.id,
            createdBy: actor.userId,
            ...data,
          },
          include: { type: true },
        });
    await this.syncHolidayEvent(tenantId, row.id, actor);
    if (!id) {
      await this.events.publish({
        event: 'calendar.holiday.published',
        tenantId,
        entityType: 'holiday',
        entityId: row.id,
        data: { holiday_name: row.name },
      });
    }
    await this.audit(
      tenantId,
      actor,
      id ? 'HOLIDAY_UPDATED' : 'HOLIDAY_CREATED',
      row.id,
      null,
      row,
    );
    if (dto.sendPush && !id) {
      const parents = await this.prisma.schoolMobileDevice.findMany({
        where: {
          tenantId,
          persona: 'parent',
          revokedAt: null,
          pushToken: { not: null },
        },
        select: { userId: true },
        distinct: ['userId'],
      });
      await this.push.onErpEvent(tenantId, 'HOLIDAY_PUBLISHED', {
        userIds: parents.map((p) => p.userId),
        title: 'Holiday announcement',
        body: `${row.name} — school will remain closed. Open the app for the holiday calendar.`,
      });
    }
    return row;
  }

  async deleteHoliday(tenantId: string, id: string, actor: CalendarActor) {
    this.assertManage(actor);
    const row = await this.prisma.schoolHoliday.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Holiday not found');
    await this.prisma.schoolHoliday.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 'DELETED',
        updatedBy: actor.userId,
        name: `${row.name} (deleted ${Date.now()})`,
      },
    });
    await this.prisma.schoolCalendarEvent.updateMany({
      where: { holidayId: id, tenantId },
      data: { deletedAt: new Date() },
    });
    await this.audit(tenantId, actor, 'HOLIDAY_DELETED', id, row, null);
    return { ok: true };
  }

  async duplicateHoliday(tenantId: string, id: string, actor: CalendarActor) {
    this.assertManage(actor);
    const row = await this.prisma.schoolHoliday.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Holiday not found');
    return this.saveHoliday(
      tenantId,
      {
        name: `${row.name} (copy)`,
        typeId: row.typeId,
        startDate: dayKey(row.startDate),
        endDate: dayKey(row.endDate),
        appliesTo: row.appliesTo,
        gradeIds: Array.isArray(row.gradeIds) ? (row.gradeIds as string[]) : [],
        sectionIds: Array.isArray(row.sectionIds)
          ? (row.sectionIds as string[])
          : [],
        description: row.description ?? undefined,
        overrideConflict: true,
        academicYearId: row.academicYearId,
      },
      actor,
    );
  }

  async importHolidays(
    tenantId: string,
    dto: ImportHolidaysDto,
    actor: CalendarActor,
  ) {
    this.assertManage(actor);
    const year = await this.ensureSetup(tenantId, dto.academicYearId);
    const types = await this.prisma.schoolHolidayType.findMany({
      where: { tenantId, deletedAt: null },
    });
    const existing = await this.listHolidays(tenantId, year.id);
    const valid: SaveHolidayDto[] = [];
    const errors: Array<{ row: number; message: string }> = [];
    dto.rows.forEach((row, i) => {
      const n = i + 2;
      if (!row.name?.trim()) {
        errors.push({ row: n, message: 'Missing holiday name' });
        return;
      }
      if (!row.startDate || Number.isNaN(parseDay(row.startDate).getTime())) {
        errors.push({ row: n, message: 'Invalid start date' });
        return;
      }
      const type =
        types.find(
          (t) => t.code.toLowerCase() === String(row.type ?? '').toLowerCase(),
        ) ||
        types.find(
          (t) => t.name.toLowerCase() === String(row.type ?? '').toLowerCase(),
        );
      if (!type) {
        errors.push({ row: n, message: 'Invalid holiday type' });
        return;
      }
      const start = parseDay(row.startDate);
      const end = parseDay(row.endDate || row.startDate);
      if (
        existing.some(
          (h) =>
            h.name === row.name!.trim() &&
            dayKey(h.startDate) === dayKey(start),
        )
      ) {
        errors.push({ row: n, message: 'Duplicate holiday' });
        return;
      }
      if (
        existing.some((h) =>
          this.overlap(parseDay(h.startDate), parseDay(h.endDate), start, end),
        )
      ) {
        errors.push({ row: n, message: 'Overlapping period' });
        return;
      }
      valid.push({
        name: row.name.trim(),
        typeId: type.id,
        startDate: dayKey(start),
        endDate: dayKey(end),
        appliesTo: row.appliesTo || 'ALL',
        description: row.description,
        academicYearId: year.id,
        overrideConflict: true,
      });
    });
    if (errors.length && !dto.confirm) {
      return {
        valid: valid.length,
        invalid: errors.length,
        errors,
        imported: 0,
      };
    }
    const toSave = valid;
    for (const row of toSave) {
      await this.saveHoliday(tenantId, row, actor);
    }
    return {
      valid: valid.length,
      invalid: errors.length,
      errors,
      imported: toSave.length,
    };
  }

  async saveOverride(
    tenantId: string,
    dto: SaveOverrideDto,
    actor: CalendarActor,
  ) {
    this.assertManage(actor);
    const year = await this.ensureSetup(tenantId, dto.academicYearId);
    const date = parseDay(dto.date);
    const row = await this.prisma.schoolCalendarOverride.upsert({
      where: {
        tenantId_academicYearId_date_kind: {
          tenantId,
          academicYearId: year.id,
          date,
          kind: dto.kind || 'SPECIAL_WORKING_DAY',
        },
      },
      update: {
        reason: dto.reason || null,
        deletedAt: null,
        createdBy: actor.userId,
      },
      create: {
        tenantId,
        academicYearId: year.id,
        date,
        kind: dto.kind || 'SPECIAL_WORKING_DAY',
        reason: dto.reason || null,
        createdBy: actor.userId,
      },
    });
    await this.audit(tenantId, actor, 'OVERRIDE_SAVED', row.id, null, row);
    return row;
  }

  async deleteOverride(tenantId: string, id: string, actor: CalendarActor) {
    this.assertManage(actor);
    await this.prisma.schoolCalendarOverride.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.audit(tenantId, actor, 'OVERRIDE_DELETED', id);
    return { ok: true };
  }

  async listOverrides(tenantId: string, academicYearId?: string) {
    const year = await this.ensureSetup(tenantId, academicYearId);
    return this.prisma.schoolCalendarOverride.findMany({
      where: { tenantId, academicYearId: year.id, deletedAt: null },
      orderBy: { date: 'asc' },
    });
  }

  async listEvents(
    tenantId: string,
    query: { academicYearId?: string; categoryId?: string; status?: string },
  ) {
    const year = await this.ensureSetup(tenantId, query.academicYearId);
    return this.prisma.schoolCalendarEvent.findMany({
      where: {
        tenantId,
        academicYearId: year.id,
        deletedAt: null,
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      include: { category: true, holiday: true, exam: true, organizer: true },
      orderBy: { startDate: 'asc' },
    });
  }

  async saveEvent(
    tenantId: string,
    dto: SaveCalendarEventDto,
    actor: CalendarActor,
    id?: string,
  ) {
    this.assertManage(actor);
    const year = await this.ensureSetup(tenantId, dto.academicYearId);
    const start = parseDay(dto.startDate);
    const end = parseDay(dto.endDate || dto.startDate);
    if (end < start)
      throw new BadRequestException('End date cannot be before the start date');
    if (start < parseDay(year.startDate) || end > parseDay(year.endDate)) {
      throw new BadRequestException(
        'Event dates must fall within the academic year',
      );
    }
    const clash = await this.prisma.schoolCalendarEvent.findFirst({
      where: {
        tenantId,
        academicYearId: year.id,
        deletedAt: null,
        status: { notIn: ['CANCELLED'] },
        ...(id ? { NOT: { id } } : {}),
        startDate: { lte: end },
        endDate: { gte: start },
      },
    });
    const holidayClash = await this.prisma.schoolHoliday.findFirst({
      where: {
        tenantId,
        academicYearId: year.id,
        deletedAt: null,
        startDate: { lte: end },
        endDate: { gte: start },
      },
    });
    if ((clash || holidayClash) && !dto.overrideConflict) {
      throw new BadRequestException(
        clash
          ? `This overlaps “${clash.title}”. Override to continue.`
          : `This overlaps holiday “${holidayClash?.name}”. Override to continue.`,
      );
    }
    const data = {
      title: dto.title.trim(),
      categoryId: dto.categoryId,
      startDate: start,
      endDate: end,
      startTime: dto.startTime || null,
      endTime: dto.endTime || null,
      allDay: dto.allDay ?? true,
      description: dto.description || null,
      audience: (dto.audience?.length
        ? dto.audience
        : ['EVERYONE']) as Prisma.InputJsonValue,
      gradeIds: (dto.gradeIds ?? []) as Prisma.InputJsonValue,
      sectionIds: (dto.sectionIds ?? []) as Prisma.InputJsonValue,
      location: dto.location || null,
      organizerType: dto.organizerType || null,
      organizerStaffId: dto.organizerStaffId || null,
      status: dto.status || 'SCHEDULED',
      importantParents: dto.importantParents ?? false,
      importantStudents: dto.importantStudents ?? false,
      importantTeachers: dto.importantTeachers ?? false,
      notifyParents: dto.notifyParents ?? false,
      notifyStudents: dto.notifyStudents ?? false,
      notifyTeachers: dto.notifyTeachers ?? false,
      ptm: dto.ptm ? (dto.ptm as Prisma.InputJsonValue) : undefined,
      updatedBy: actor.userId,
    };
    const existing = id
      ? await this.prisma.schoolCalendarEvent.findFirst({
          where: { id, tenantId, deletedAt: null },
        })
      : null;
    if (id && !existing) throw new NotFoundException('Event not found');
    if (existing?.source !== 'MANUAL' && id) {
      throw new BadRequestException(
        'Linked holiday or examination events must be edited at the source',
      );
    }
    const row = id
      ? await this.prisma.schoolCalendarEvent.update({
          where: { id },
          data,
          include: { category: true, organizer: true },
        })
      : await this.prisma.schoolCalendarEvent.create({
          data: {
            tenantId,
            academicYearId: year.id,
            source: 'MANUAL',
            createdBy: actor.userId,
            ...data,
          },
          include: { category: true, organizer: true },
        });
    await this.audit(
      tenantId,
      actor,
      id ? 'EVENT_UPDATED' : 'EVENT_CREATED',
      row.id,
      existing,
      row,
    );
    return row;
  }

  async deleteEvent(tenantId: string, id: string, actor: CalendarActor) {
    this.assertManage(actor);
    const row = await this.prisma.schoolCalendarEvent.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Event not found');
    if (row.source !== 'MANUAL') {
      throw new BadRequestException(
        'Remove the linked holiday or examination instead',
      );
    }
    await this.prisma.schoolCalendarEvent.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: actor.userId },
    });
    await this.audit(tenantId, actor, 'EVENT_DELETED', id, row, null);
    return { ok: true };
  }

  async syncHolidayEvent(
    tenantId: string,
    holidayId: string,
    actor?: CalendarActor,
  ) {
    const holiday = await this.prisma.schoolHoliday.findFirst({
      where: { id: holidayId, tenantId },
      include: { type: true },
    });
    if (!holiday || holiday.deletedAt) return null;
    const catCode = holiday.type.kind === 'VACATION' ? 'VACATION' : 'HOLIDAY';
    const category = await this.prisma.schoolCalendarEventCategory.findFirst({
      where: { tenantId, code: catCode, deletedAt: null },
    });
    if (!category) return null;
    return this.prisma.schoolCalendarEvent.upsert({
      where: { holidayId },
      update: {
        title: holiday.name,
        startDate: holiday.startDate,
        endDate: holiday.endDate,
        categoryId: category.id,
        description: holiday.description,
        deletedAt: null,
        audience: ['EVERYONE'] as Prisma.InputJsonValue,
      },
      create: {
        tenantId,
        academicYearId: holiday.academicYearId,
        categoryId: category.id,
        title: holiday.name,
        startDate: holiday.startDate,
        endDate: holiday.endDate,
        allDay: true,
        description: holiday.description,
        source: 'HOLIDAY',
        holidayId: holiday.id,
        createdBy: actor?.userId,
      },
    });
  }

  async upsertExamEvent(
    tenantId: string,
    exam: {
      id: string;
      academicYearId: string;
      name: string;
      startDate: Date | null;
      endDate: Date | null;
      description: string | null;
    },
    enabled: boolean,
    actor: CalendarActor,
  ) {
    if (!enabled || !exam.startDate) {
      await this.prisma.schoolCalendarEvent.updateMany({
        where: { examId: exam.id, tenantId },
        data: { deletedAt: new Date() },
      });
      return null;
    }
    const category = await this.prisma.schoolCalendarEventCategory.findFirst({
      where: { tenantId, code: 'EXAMINATION', deletedAt: null },
    });
    if (!category) return null;
    await this.ensureSetup(tenantId, exam.academicYearId);
    return this.prisma.schoolCalendarEvent.upsert({
      where: { examId: exam.id },
      update: {
        title: exam.name,
        startDate: exam.startDate,
        endDate: exam.endDate ?? exam.startDate,
        description: exam.description,
        deletedAt: null,
        categoryId: category.id,
      },
      create: {
        tenantId,
        academicYearId: exam.academicYearId,
        categoryId: category.id,
        title: exam.name,
        startDate: exam.startDate,
        endDate: exam.endDate ?? exam.startDate,
        allDay: true,
        description: exam.description,
        source: 'EXAM',
        examId: exam.id,
        createdBy: actor.userId,
      },
    });
  }

  async reports(tenantId: string, kind: string, academicYearId?: string) {
    const year = await this.ensureSetup(tenantId, academicYearId);
    const holidays = await this.listHolidays(tenantId, year.id);
    const events = await this.listEvents(tenantId, { academicYearId: year.id });
    const dash = await this.dashboard(tenantId, year.id);
    if (kind === 'VACATION')
      return {
        year,
        rows: holidays.filter((h) => h.type.kind === 'VACATION'),
        dash,
      };
    if (kind === 'WORKING') return { year, dash };
    if (kind === 'EXAM')
      return {
        year,
        rows: events.filter((e) => e.category.code === 'EXAMINATION'),
      };
    if (kind === 'PTM')
      return { year, rows: events.filter((e) => e.category.code === 'PTM') };
    if (kind === 'EVENTS')
      return { year, rows: events.filter((e) => e.source === 'MANUAL') };
    if (kind === 'ACADEMIC') return { year, rows: events };
    return { year, rows: holidays, dash };
  }
}
