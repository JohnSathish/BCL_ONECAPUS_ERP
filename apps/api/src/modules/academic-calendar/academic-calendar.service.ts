import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../database/prisma.service';
import {
  ACADEMIC_CALENDAR_EVENT_TYPES,
  defaultCreatesAttendanceSession,
  defaultIsWorkingDayForType,
  mapStaffHolidayType,
  parseDateOnly,
  toDateOnlyIso,
} from './academic-calendar.types';
import { WorkingDayEngineService } from './working-day-engine.service';

@Injectable()
export class AcademicCalendarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: WorkingDayEngineService,
  ) {}

  listEventTypes() {
    return ACADEMIC_CALENDAR_EVENT_TYPES.map((type) => ({
      type,
      defaultIsWorkingDay: defaultIsWorkingDayForType(type),
      defaultCreatesAttendanceSession: defaultCreatesAttendanceSession(type),
    }));
  }

  async listYears(tenantId: string, institutionId?: string) {
    const years = await this.prisma.academicYear.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(institutionId ? { institutionId } : {}),
      },
      orderBy: [{ startDate: 'desc' }],
      include: {
        academicCalendar: {
          where: { deletedAt: null },
          include: { _count: { select: { events: true } } },
        },
      },
    });
    return years.map((year) => ({
      id: year.id,
      name: year.name,
      institutionId: year.institutionId,
      startDate: toDateOnlyIso(year.startDate),
      endDate: toDateOnlyIso(year.endDate),
      calendar: year.academicCalendar
        ? {
            id: year.academicCalendar.id,
            title: year.academicCalendar.title,
            status: year.academicCalendar.status,
            weekendDays: year.academicCalendar.weekendDays,
            publishedAt: year.academicCalendar.publishedAt,
            eventCount: year.academicCalendar._count.events,
          }
        : null,
    }));
  }

  async getOrCreateForYear(
    user: JwtUser,
    academicYearId: string,
    opts?: { title?: string; weekendDays?: number[] },
  ) {
    const year = await this.requireYear(user.tid, academicYearId);
    const existing = await this.prisma.academicCalendar.findFirst({
      where: { tenantId: user.tid, academicYearId, deletedAt: null },
    });
    if (existing) return this.getCalendar(user.tid, existing.id);

    const created = await this.prisma.academicCalendar.create({
      data: {
        tenantId: user.tid,
        institutionId: year.institutionId,
        academicYearId: year.id,
        title: opts?.title?.trim() || `${year.name} Academic Calendar`,
        weekendDays: (opts?.weekendDays ?? [
          0,
        ]) as unknown as Prisma.InputJsonValue,
        createdById: user.sub,
        updatedById: user.sub,
      },
    });
    return this.getCalendar(user.tid, created.id);
  }

  async getCalendar(tenantId: string, calendarId: string) {
    const calendar = await this.prisma.academicCalendar.findFirst({
      where: { id: calendarId, tenantId, deletedAt: null },
      include: {
        academicYear: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
            institutionId: true,
          },
        },
        _count: { select: { events: true } },
      },
    });
    if (!calendar) throw new NotFoundException('Academic calendar not found');
    return {
      id: calendar.id,
      title: calendar.title,
      status: calendar.status,
      weekendDays: calendar.weekendDays,
      publishedAt: calendar.publishedAt,
      institutionId: calendar.institutionId,
      academicYearId: calendar.academicYearId,
      academicYear: {
        ...calendar.academicYear,
        startDate: toDateOnlyIso(calendar.academicYear.startDate),
        endDate: toDateOnlyIso(calendar.academicYear.endDate),
      },
      eventCount: calendar._count.events,
      createdAt: calendar.createdAt,
      updatedAt: calendar.updatedAt,
    };
  }

  async updateCalendar(
    user: JwtUser,
    calendarId: string,
    dto: {
      title?: string;
      weekendDays?: number[];
    },
  ) {
    await this.requireCalendar(user.tid, calendarId);
    const updated = await this.prisma.academicCalendar.update({
      where: { id: calendarId },
      data: {
        ...(dto.title != null ? { title: dto.title.trim() } : {}),
        ...(dto.weekendDays != null
          ? { weekendDays: dto.weekendDays as unknown as Prisma.InputJsonValue }
          : {}),
        updatedById: user.sub,
      },
    });
    return this.getCalendar(user.tid, updated.id);
  }

  async publish(user: JwtUser, calendarId: string) {
    await this.requireCalendar(user.tid, calendarId);
    await this.prisma.academicCalendar.update({
      where: { id: calendarId },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        updatedById: user.sub,
      },
    });
    return this.getCalendar(user.tid, calendarId);
  }

  async unpublish(user: JwtUser, calendarId: string) {
    await this.requireCalendar(user.tid, calendarId);
    await this.prisma.academicCalendar.update({
      where: { id: calendarId },
      data: {
        status: 'DRAFT',
        updatedById: user.sub,
      },
    });
    return this.getCalendar(user.tid, calendarId);
  }

  async listEvents(
    tenantId: string,
    calendarId: string,
    query?: {
      from?: string;
      to?: string;
      type?: string;
      visibility?: string;
    },
  ) {
    await this.requireCalendar(tenantId, calendarId);
    const from = query?.from ? parseDateOnly(query.from) : undefined;
    const to = query?.to ? parseDateOnly(query.to) : undefined;
    const rows = await this.prisma.academicCalendarEvent.findMany({
      where: {
        tenantId,
        calendarId,
        deletedAt: null,
        ...(query?.type ? { type: query.type } : {}),
        ...(query?.visibility ? { visibility: query.visibility } : {}),
        ...(from || to
          ? {
              AND: [
                ...(from ? [{ endDate: { gte: from } }] : []),
                ...(to ? [{ startDate: { lte: to } }] : []),
              ],
            }
          : {}),
      },
      orderBy: [{ startDate: 'asc' }, { title: 'asc' }],
    });
    return rows.map((row) => this.mapEvent(row));
  }

  async createEvent(
    user: JwtUser,
    calendarId: string,
    dto: {
      type: string;
      title: string;
      description?: string;
      startDate: string;
      endDate?: string;
      startTime?: string;
      endTime?: string;
      isWorkingDay?: boolean | null;
      createsAttendanceSession?: boolean;
      scopeType?: string;
      campusId?: string;
      departmentIds?: string[];
      visibility?: string;
      publishedToWebsite?: boolean;
      active?: boolean;
    },
  ) {
    await this.requireCalendar(user.tid, calendarId);
    this.assertEventType(dto.type);
    const startDate = parseDateOnly(dto.startDate);
    const endDate = parseDateOnly(dto.endDate ?? dto.startDate);
    if (endDate < startDate) {
      throw new BadRequestException('endDate must be on or after startDate');
    }
    const createsAttendanceSession =
      dto.createsAttendanceSession ?? defaultCreatesAttendanceSession(dto.type);
    const row = await this.prisma.academicCalendarEvent.create({
      data: {
        tenantId: user.tid,
        calendarId,
        type: dto.type,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        startDate,
        endDate,
        startTime: dto.startTime ?? null,
        endTime: dto.endTime ?? null,
        isWorkingDay: dto.isWorkingDay === undefined ? null : dto.isWorkingDay,
        createsAttendanceSession,
        scopeType: dto.scopeType ?? 'INSTITUTION',
        campusId: dto.campusId ?? null,
        departmentIds: dto.departmentIds
          ? (dto.departmentIds as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        visibility: dto.visibility ?? 'INTERNAL',
        publishedToWebsite: Boolean(dto.publishedToWebsite),
        active: dto.active ?? true,
        createdById: user.sub,
        updatedById: user.sub,
      },
    });
    return this.mapEvent(row);
  }

  async updateEvent(
    user: JwtUser,
    eventId: string,
    dto: Partial<{
      type: string;
      title: string;
      description: string | null;
      startDate: string;
      endDate: string;
      startTime: string | null;
      endTime: string | null;
      isWorkingDay: boolean | null;
      createsAttendanceSession: boolean;
      scopeType: string;
      campusId: string | null;
      departmentIds: string[] | null;
      visibility: string;
      publishedToWebsite: boolean;
      active: boolean;
    }>,
  ) {
    const existing = await this.requireEvent(user.tid, eventId);
    if (dto.type) this.assertEventType(dto.type);
    const startDate = dto.startDate
      ? parseDateOnly(dto.startDate)
      : existing.startDate;
    const endDate = dto.endDate ? parseDateOnly(dto.endDate) : existing.endDate;
    if (endDate < startDate) {
      throw new BadRequestException('endDate must be on or after startDate');
    }
    const row = await this.prisma.academicCalendarEvent.update({
      where: { id: eventId },
      data: {
        ...(dto.type != null ? { type: dto.type } : {}),
        ...(dto.title != null ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() || null }
          : {}),
        ...(dto.startDate != null ? { startDate } : {}),
        ...(dto.endDate != null ? { endDate } : {}),
        ...(dto.startTime !== undefined ? { startTime: dto.startTime } : {}),
        ...(dto.endTime !== undefined ? { endTime: dto.endTime } : {}),
        ...(dto.isWorkingDay !== undefined
          ? { isWorkingDay: dto.isWorkingDay }
          : {}),
        ...(dto.createsAttendanceSession !== undefined
          ? { createsAttendanceSession: dto.createsAttendanceSession }
          : {}),
        ...(dto.scopeType != null ? { scopeType: dto.scopeType } : {}),
        ...(dto.campusId !== undefined ? { campusId: dto.campusId } : {}),
        ...(dto.departmentIds !== undefined
          ? {
              departmentIds: dto.departmentIds
                ? (dto.departmentIds as unknown as Prisma.InputJsonValue)
                : Prisma.JsonNull,
            }
          : {}),
        ...(dto.visibility != null ? { visibility: dto.visibility } : {}),
        ...(dto.publishedToWebsite !== undefined
          ? { publishedToWebsite: dto.publishedToWebsite }
          : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
        updatedById: user.sub,
      },
    });
    return this.mapEvent(row);
  }

  async deleteEvent(user: JwtUser, eventId: string) {
    await this.requireEvent(user.tid, eventId);
    await this.prisma.academicCalendarEvent.update({
      where: { id: eventId },
      data: { deletedAt: new Date(), active: false, updatedById: user.sub },
    });
    return { ok: true };
  }

  async bulkCreateHolidays(
    user: JwtUser,
    calendarId: string,
    items: Array<{
      title: string;
      date: string;
      type?: string;
      endDate?: string;
      visibility?: string;
      publishedToWebsite?: boolean;
      scopeType?: string;
      campusId?: string;
      departmentIds?: string[];
    }>,
  ) {
    await this.requireCalendar(user.tid, calendarId);
    if (!items?.length) throw new BadRequestException('No holidays provided');
    const created = [];
    for (const item of items) {
      const type = item.type ?? 'COLLEGE_HOLIDAY';
      this.assertEventType(type);
      created.push(
        await this.createEvent(user, calendarId, {
          type,
          title: item.title,
          startDate: item.date,
          endDate: item.endDate ?? item.date,
          visibility: item.visibility ?? 'PUBLIC',
          publishedToWebsite: item.publishedToWebsite ?? true,
          scopeType: item.scopeType,
          campusId: item.campusId,
          departmentIds: item.departmentIds,
          isWorkingDay: false,
          createsAttendanceSession: false,
        }),
      );
    }
    return { created: created.length, events: created };
  }

  async importStaffHolidays(user: JwtUser, calendarId: string) {
    const calendar = await this.requireCalendar(user.tid, calendarId);
    const year = await this.requireYear(user.tid, calendar.academicYearId);
    const holidays = await this.prisma.staffPublicHoliday.findMany({
      where: {
        tenantId: user.tid,
        active: true,
        holidayDate: {
          gte: year.startDate,
          lte: year.endDate,
        },
      },
      orderBy: { holidayDate: 'asc' },
    });

    let imported = 0;
    let skipped = 0;
    for (const holiday of holidays) {
      const type = mapStaffHolidayType(holiday.holidayType);
      const date = holiday.holidayDate;
      const existing = await this.prisma.academicCalendarEvent.findFirst({
        where: {
          tenantId: user.tid,
          calendarId,
          deletedAt: null,
          startDate: date,
          endDate: date,
          title: holiday.name,
          OR: [
            { sourceModule: 'staff_public_holiday', sourceRefId: holiday.id },
            { type, title: holiday.name },
          ],
        },
      });
      if (existing) {
        skipped += 1;
        continue;
      }
      await this.prisma.academicCalendarEvent.create({
        data: {
          tenantId: user.tid,
          calendarId,
          type,
          title: holiday.name,
          startDate: date,
          endDate: date,
          isWorkingDay: false,
          createsAttendanceSession: false,
          scopeType: holiday.scopeType || 'INSTITUTION',
          campusId: holiday.campusId,
          departmentIds: holiday.departmentIds ?? Prisma.JsonNull,
          visibility: 'PUBLIC',
          publishedToWebsite: true,
          sourceModule: 'staff_public_holiday',
          sourceRefId: holiday.id,
          createdById: user.sub,
          updatedById: user.sub,
        },
      });
      imported += 1;
    }
    return { imported, skipped, total: holidays.length };
  }

  /**
   * Upsert a calendar event keyed by sourceModule + sourceRefId.
   * Used by Examinations / Fees / Admissions writers (Phase 3+).
   */
  async upsertFromSource(
    user: JwtUser,
    input: {
      academicYearId: string;
      sourceModule: string;
      sourceRefId: string;
      type: string;
      title: string;
      description?: string | null;
      startDate: string;
      endDate?: string;
      startTime?: string | null;
      endTime?: string | null;
      visibility?: 'INTERNAL' | 'PUBLIC';
      publishedToWebsite?: boolean;
      createsAttendanceSession?: boolean;
      isWorkingDay?: boolean | null;
      scopeType?: string;
      departmentIds?: string[];
    },
  ) {
    this.assertEventType(input.type);
    const calendar = await this.getOrCreateForYear(user, input.academicYearId);
    const startDate = parseDateOnly(input.startDate);
    const endDate = parseDateOnly(input.endDate ?? input.startDate);
    if (endDate < startDate) {
      throw new BadRequestException('endDate must be on or after startDate');
    }

    const existing = await this.prisma.academicCalendarEvent.findFirst({
      where: {
        tenantId: user.tid,
        sourceModule: input.sourceModule,
        sourceRefId: input.sourceRefId,
      },
      orderBy: { updatedAt: 'desc' },
    });

    const data = {
      calendarId: calendar.id,
      type: input.type,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      startDate,
      endDate,
      startTime: input.startTime ?? null,
      endTime: input.endTime ?? null,
      isWorkingDay:
        input.isWorkingDay === undefined ? null : input.isWorkingDay,
      createsAttendanceSession:
        input.createsAttendanceSession ??
        defaultCreatesAttendanceSession(input.type),
      scopeType: input.scopeType ?? 'INSTITUTION',
      departmentIds: input.departmentIds?.length
        ? (input.departmentIds as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      visibility: input.visibility ?? 'INTERNAL',
      publishedToWebsite: Boolean(input.publishedToWebsite),
      sourceModule: input.sourceModule,
      sourceRefId: input.sourceRefId,
      active: true,
      updatedById: user.sub,
    };

    if (existing) {
      const row = await this.prisma.academicCalendarEvent.update({
        where: { id: existing.id },
        data: {
          ...data,
          deletedAt: null,
        },
      });
      return this.mapEvent(row);
    }

    const row = await this.prisma.academicCalendarEvent.create({
      data: {
        tenantId: user.tid,
        ...data,
        createdById: user.sub,
      },
    });
    return this.mapEvent(row);
  }

  async removeFromSource(
    tenantId: string,
    sourceModule: string,
    sourceRefId: string,
    updatedById?: string,
  ) {
    const rows = await this.prisma.academicCalendarEvent.findMany({
      where: {
        tenantId,
        sourceModule,
        sourceRefId,
        deletedAt: null,
      },
    });
    if (!rows.length) return { removed: 0 };
    await this.prisma.academicCalendarEvent.updateMany({
      where: { id: { in: rows.map((r) => r.id) } },
      data: {
        deletedAt: new Date(),
        active: false,
        ...(updatedById ? { updatedById } : {}),
      },
    });
    return { removed: rows.length };
  }

  resolveDay(
    tenantId: string,
    date: string,
    ctx?: {
      campusId?: string;
      departmentId?: string;
      calendarId?: string;
      academicYearId?: string;
    },
  ) {
    return this.engine.resolveDay(tenantId, date, ctx);
  }

  resolveRange(
    tenantId: string,
    from: string,
    to: string,
    ctx?: {
      campusId?: string;
      departmentId?: string;
      calendarId?: string;
      academicYearId?: string;
    },
  ) {
    return this.engine.resolveRange(tenantId, from, to, ctx);
  }

  async listPublicWebsiteEvents(tenantId: string, limit = 12) {
    const today = parseDateOnly(toDateOnlyIso(new Date()));
    const rows = await this.prisma.academicCalendarEvent.findMany({
      where: {
        tenantId,
        deletedAt: null,
        active: true,
        visibility: 'PUBLIC',
        publishedToWebsite: true,
        endDate: { gte: today },
        calendar: {
          deletedAt: null,
          status: 'PUBLISHED',
        },
      },
      orderBy: [{ startDate: 'asc' }, { title: 'asc' }],
      take: limit,
      include: {
        calendar: { select: { id: true, title: true, academicYearId: true } },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      date: toDateOnlyIso(row.startDate),
      endDate: toDateOnlyIso(row.endDate),
      category: row.type,
      href: '/academics/calendar',
      registrationUrl: null,
      featured: false,
      showCountdown: false,
      source: 'ERP',
      type: row.type,
      description: row.description,
    }));
  }

  private mapEvent(row: {
    id: string;
    calendarId: string;
    type: string;
    title: string;
    description: string | null;
    startDate: Date;
    endDate: Date;
    startTime: string | null;
    endTime: string | null;
    isWorkingDay: boolean | null;
    createsAttendanceSession: boolean;
    scopeType: string;
    campusId: string | null;
    departmentIds: unknown;
    visibility: string;
    sourceModule: string | null;
    sourceRefId: string | null;
    publishedToWebsite: boolean;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      calendarId: row.calendarId,
      type: row.type,
      title: row.title,
      description: row.description,
      startDate: toDateOnlyIso(row.startDate),
      endDate: toDateOnlyIso(row.endDate),
      startTime: row.startTime,
      endTime: row.endTime,
      isWorkingDay: row.isWorkingDay,
      createsAttendanceSession: row.createsAttendanceSession,
      scopeType: row.scopeType,
      campusId: row.campusId,
      departmentIds: Array.isArray(row.departmentIds)
        ? (row.departmentIds as unknown[]).map(String)
        : [],
      visibility: row.visibility,
      sourceModule: row.sourceModule,
      sourceRefId: row.sourceRefId,
      publishedToWebsite: row.publishedToWebsite,
      active: row.active,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private assertEventType(type: string) {
    if (!(ACADEMIC_CALENDAR_EVENT_TYPES as readonly string[]).includes(type)) {
      throw new BadRequestException(`Invalid event type: ${type}`);
    }
  }

  private async requireYear(tenantId: string, academicYearId: string) {
    const year = await this.prisma.academicYear.findFirst({
      where: { id: academicYearId, tenantId, deletedAt: null },
    });
    if (!year) throw new NotFoundException('Academic year not found');
    return year;
  }

  private async requireCalendar(tenantId: string, calendarId: string) {
    const calendar = await this.prisma.academicCalendar.findFirst({
      where: { id: calendarId, tenantId, deletedAt: null },
    });
    if (!calendar) throw new NotFoundException('Academic calendar not found');
    return calendar;
  }

  private async requireEvent(tenantId: string, eventId: string) {
    const event = await this.prisma.academicCalendarEvent.findFirst({
      where: { id: eventId, tenantId, deletedAt: null },
    });
    if (!event) throw new NotFoundException('Calendar event not found');
    return event;
  }
}
