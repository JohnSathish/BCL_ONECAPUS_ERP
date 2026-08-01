import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { resolveTenantUploadRoot } from '../../common/uploads/upload-paths';
import { PrismaService } from '../../database/prisma.service';
import {
  ACADEMIC_CALENDAR_EVENT_TYPES,
  EXAM_TYPES,
  defaultColorForType,
  defaultCreatesAttendanceSession,
  defaultIsWorkingDayForType,
  filterGroupForType,
  mapStaffHolidayType,
  parseDateOnly,
  statusLabelForType,
  toDateOnlyIso,
  type CalendarAttachmentMeta,
  type CalendarVisibilityFlags,
} from './academic-calendar.types';
import {
  assertCanCreateType,
  assertCanWriteEvent,
  canPublishCalendar,
} from './calendar-rbac.policy';
import { expandRruleOccurrences } from './rrule-expand';
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
      label: type
        .split('_')
        .map((p) => p.charAt(0) + p.slice(1).toLowerCase())
        .join(' '),
      defaultColor: defaultColorForType(type),
      filterGroup: filterGroupForType(type),
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
    // Central calendar: Publish makes active events visible on the college website.
    await this.prisma.academicCalendarEvent.updateMany({
      where: {
        tenantId: user.tid,
        calendarId,
        deletedAt: null,
        active: true,
      },
      data: {
        publishedToWebsite: true,
        visibility: 'PUBLIC',
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
      types?: string[];
      visibility?: string;
      q?: string;
      departmentId?: string;
      expandRecurrence?: boolean;
    },
  ) {
    await this.requireCalendar(tenantId, calendarId);
    const from = query?.from ? parseDateOnly(query.from) : undefined;
    const to = query?.to ? parseDateOnly(query.to) : undefined;
    const types = query?.types?.length
      ? query.types
      : query?.type
        ? [query.type]
        : undefined;
    const rows = await this.prisma.academicCalendarEvent.findMany({
      where: {
        tenantId,
        calendarId,
        deletedAt: null,
        ...(types?.length ? { type: { in: types } } : {}),
        ...(query?.visibility ? { visibility: query.visibility } : {}),
        ...(query?.q?.trim()
          ? {
              OR: [
                { title: { contains: query.q.trim(), mode: 'insensitive' } },
                {
                  description: {
                    contains: query.q.trim(),
                    mode: 'insensitive',
                  },
                },
                { venue: { contains: query.q.trim(), mode: 'insensitive' } },
                {
                  organizerName: {
                    contains: query.q.trim(),
                    mode: 'insensitive',
                  },
                },
                { type: { contains: query.q.trim(), mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(query?.departmentId ? {} : {}),
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

    let mapped = rows.map((row) => this.mapEvent(row));
    if (query?.departmentId) {
      const dept = query.departmentId;
      mapped = mapped.filter(
        (e) => !e.departmentIds.length || e.departmentIds.includes(dept),
      );
    }
    if (!query?.expandRecurrence || !from || !to) return mapped;

    const rangeFrom = toDateOnlyIso(from);
    const rangeTo = toDateOnlyIso(to);
    const expanded: typeof mapped = [];
    for (const ev of mapped) {
      if (!ev.isRecurring || !ev.recurrenceRule) {
        expanded.push(ev);
        continue;
      }
      const occs = expandRruleOccurrences({
        startDate: ev.startDate,
        endDate: ev.endDate,
        recurrenceRule: ev.recurrenceRule,
        rangeFrom,
        rangeTo,
      });
      for (const occ of occs) {
        expanded.push({
          ...ev,
          id: `${ev.id}::${occ.startDate}`,
          occurrenceOf: ev.id,
          startDate: occ.startDate,
          endDate: occ.endDate,
        });
      }
    }
    return expanded.sort((a, b) =>
      a.startDate === b.startDate
        ? a.title.localeCompare(b.title)
        : a.startDate.localeCompare(b.startDate),
    );
  }

  async getEvent(tenantId: string, eventId: string) {
    const row = await this.requireEvent(tenantId, eventId);
    return this.mapEvent(row);
  }

  async monthSummary(
    tenantId: string,
    calendarId: string,
    year: number,
    month: number,
  ) {
    const from = `${year}-${String(month).padStart(2, '0')}-01`;
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const to = `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
    const days = await this.engine.resolveRange(tenantId, from, to, {
      calendarId,
    });
    const events = await this.listEvents(tenantId, calendarId, {
      from,
      to,
      expandRecurrence: true,
    });
    const today = toDateOnlyIso(new Date());
    const holidays = days.filter((d) => d.dayKind === 'HOLIDAY').length;
    const weekends = days.filter((d) => d.dayKind === 'WEEKEND').length;
    const working = days.filter((d) => d.isWorkingDay).length;
    const exams = events.filter((e) =>
      [
        'INTERNAL_ASSESSMENT',
        'MID_SEM_EXAM',
        'END_SEM_EXAM',
        'PRACTICAL_EXAM',
        'VIVA',
      ].includes(e.type),
    ).length;
    const meetings = events.filter((e) =>
      ['STAFF_MEETING', 'DEPARTMENT_MEETING', 'STAFF_EVENT'].includes(e.type),
    ).length;
    return {
      year,
      month,
      from,
      to,
      workingDays: working,
      weekends,
      holidays,
      exams,
      meetings,
      eventsThisMonth: events.length,
      todaysEvents: events.filter(
        (e) => e.startDate <= today && e.endDate >= today,
      ).length,
      upcomingEvents: events.filter((e) => e.startDate > today).length,
    };
  }

  async todayEvents(tenantId: string, calendarId: string) {
    const today = toDateOnlyIso(new Date());
    return this.listEvents(tenantId, calendarId, {
      from: today,
      to: today,
      expandRecurrence: true,
    });
  }

  async upcomingEvents(tenantId: string, calendarId: string, limit = 20) {
    const today = toDateOnlyIso(new Date());
    const to = toDateOnlyIso(new Date(Date.now() + 90 * 86_400_000));
    const events = await this.listEvents(tenantId, calendarId, {
      from: today,
      to,
      expandRecurrence: true,
    });
    return events.filter((e) => e.startDate >= today).slice(0, limit);
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
      color?: string;
      icon?: string;
      venue?: string;
      isAllDay?: boolean;
      isRecurring?: boolean;
      recurrenceRule?: string;
      programmeId?: string;
      semesterId?: string;
      shiftId?: string;
      visibilityFlags?: CalendarVisibilityFlags;
      organizerName?: string;
    },
  ) {
    await this.requireCalendar(user.tid, calendarId);
    this.assertEventType(dto.type);
    assertCanCreateType(user, dto.type, dto.departmentIds);
    if (dto.publishedToWebsite && !canPublishCalendar(user)) {
      throw new BadRequestException(
        'Only managers can publish events to website',
      );
    }
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
        startTime:
          dto.isAllDay === false
            ? (dto.startTime ?? null)
            : (dto.startTime ?? null),
        endTime: dto.endTime ?? null,
        isWorkingDay: dto.isWorkingDay === undefined ? null : dto.isWorkingDay,
        createsAttendanceSession,
        scopeType: dto.scopeType ?? 'INSTITUTION',
        campusId: dto.campusId ?? null,
        departmentIds: dto.departmentIds
          ? (dto.departmentIds as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        visibility: dto.visibility ?? 'PUBLIC',
        publishedToWebsite:
          dto.publishedToWebsite !== undefined
            ? Boolean(dto.publishedToWebsite)
            : true,
        active: dto.active ?? true,
        color: dto.color?.trim() || null,
        icon: dto.icon?.trim() || null,
        venue: dto.venue?.trim() || null,
        isAllDay: dto.isAllDay ?? true,
        isRecurring: Boolean(dto.isRecurring && dto.recurrenceRule),
        recurrenceRule: dto.recurrenceRule?.trim() || null,
        programmeId: dto.programmeId ?? null,
        semesterId: dto.semesterId ?? null,
        shiftId: dto.shiftId ?? null,
        visibilityFlags: dto.visibilityFlags
          ? (dto.visibilityFlags as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        organizerName: dto.organizerName?.trim() || null,
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
      color: string | null;
      icon: string | null;
      venue: string | null;
      isAllDay: boolean;
      isRecurring: boolean;
      recurrenceRule: string | null;
      programmeId: string | null;
      semesterId: string | null;
      shiftId: string | null;
      visibilityFlags: CalendarVisibilityFlags | null;
      organizerName: string | null;
    }>,
  ) {
    const existing = await this.requireEvent(user.tid, eventId);
    assertCanWriteEvent(user, 'update', {
      type: dto.type ?? existing.type,
      createdById: existing.createdById,
      departmentIds: dto.departmentIds ?? existing.departmentIds,
      sourceModule: existing.sourceModule,
    });
    if (dto.publishedToWebsite && !canPublishCalendar(user)) {
      throw new BadRequestException(
        'Only managers can publish events to website',
      );
    }
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
        ...(dto.color !== undefined
          ? { color: dto.color?.trim() || null }
          : {}),
        ...(dto.icon !== undefined ? { icon: dto.icon?.trim() || null } : {}),
        ...(dto.venue !== undefined
          ? { venue: dto.venue?.trim() || null }
          : {}),
        ...(dto.isAllDay !== undefined ? { isAllDay: dto.isAllDay } : {}),
        ...(dto.isRecurring !== undefined
          ? { isRecurring: dto.isRecurring }
          : {}),
        ...(dto.recurrenceRule !== undefined
          ? { recurrenceRule: dto.recurrenceRule?.trim() || null }
          : {}),
        ...(dto.programmeId !== undefined
          ? { programmeId: dto.programmeId }
          : {}),
        ...(dto.semesterId !== undefined ? { semesterId: dto.semesterId } : {}),
        ...(dto.shiftId !== undefined ? { shiftId: dto.shiftId } : {}),
        ...(dto.visibilityFlags !== undefined
          ? {
              visibilityFlags: dto.visibilityFlags
                ? (dto.visibilityFlags as unknown as Prisma.InputJsonValue)
                : Prisma.JsonNull,
            }
          : {}),
        ...(dto.organizerName !== undefined
          ? { organizerName: dto.organizerName?.trim() || null }
          : {}),
        updatedById: user.sub,
      },
    });
    return this.mapEvent(row);
  }

  async deleteEvent(user: JwtUser, eventId: string) {
    const existing = await this.requireEvent(user.tid, eventId);
    assertCanWriteEvent(user, 'delete', {
      type: existing.type,
      createdById: existing.createdById,
      departmentIds: existing.departmentIds,
      sourceModule: existing.sourceModule,
    });
    await this.prisma.academicCalendarEvent.update({
      where: { id: eventId },
      data: { deletedAt: new Date(), active: false, updatedById: user.sub },
    });
    return { ok: true };
  }

  async duplicateEvent(user: JwtUser, eventId: string) {
    const existing = await this.requireEvent(user.tid, eventId);
    assertCanCreateType(
      user,
      existing.type,
      Array.isArray(existing.departmentIds)
        ? (existing.departmentIds as string[])
        : undefined,
    );
    return this.createEvent(user, existing.calendarId, {
      type: existing.type,
      title: `${existing.title} (Copy)`,
      description: existing.description ?? undefined,
      startDate: toDateOnlyIso(existing.startDate),
      endDate: toDateOnlyIso(existing.endDate),
      startTime: existing.startTime ?? undefined,
      endTime: existing.endTime ?? undefined,
      isWorkingDay: existing.isWorkingDay,
      createsAttendanceSession: existing.createsAttendanceSession,
      scopeType: existing.scopeType,
      campusId: existing.campusId ?? undefined,
      departmentIds: Array.isArray(existing.departmentIds)
        ? (existing.departmentIds as string[])
        : undefined,
      visibility: existing.visibility,
      publishedToWebsite: false,
      color: existing.color ?? undefined,
      icon: existing.icon ?? undefined,
      venue: existing.venue ?? undefined,
      isAllDay: existing.isAllDay,
      isRecurring: existing.isRecurring,
      recurrenceRule: existing.recurrenceRule ?? undefined,
      programmeId: existing.programmeId ?? undefined,
      semesterId: existing.semesterId ?? undefined,
      shiftId: existing.shiftId ?? undefined,
      organizerName: existing.organizerName ?? undefined,
    });
  }

  async addAttachment(
    user: JwtUser,
    eventId: string,
    file: Express.Multer.File,
  ) {
    const existing = await this.requireEvent(user.tid, eventId);
    assertCanWriteEvent(user, 'update', {
      type: existing.type,
      createdById: existing.createdById,
      departmentIds: existing.departmentIds,
      sourceModule: existing.sourceModule,
    });
    const allowed = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
    ];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException('Only PDF or images are allowed');
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('Attachment max size is 10MB');
    }
    const dir = join(
      resolveTenantUploadRoot(),
      user.tid,
      'academic-calendar',
      eventId,
    );
    await mkdir(dir, { recursive: true });
    const ext =
      file.mimetype === 'application/pdf'
        ? 'pdf'
        : file.mimetype.includes('png')
          ? 'png'
          : file.mimetype.includes('webp')
            ? 'webp'
            : 'jpg';
    const filename = `${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
    await writeFile(join(dir, filename), file.buffer);
    const publicPath = `/uploads/tenants/${user.tid}/academic-calendar/${eventId}/${filename}`;
    const current = (
      Array.isArray(existing.attachmentUrls) ? existing.attachmentUrls : []
    ) as CalendarAttachmentMeta[];
    const next: CalendarAttachmentMeta[] = [
      ...current,
      {
        url: publicPath,
        name: file.originalname || filename,
        mimeType: file.mimetype,
        size: file.size,
      },
    ];
    const row = await this.prisma.academicCalendarEvent.update({
      where: { id: eventId },
      data: {
        attachmentUrls: next as unknown as Prisma.InputJsonValue,
        updatedById: user.sub,
      },
    });
    return this.mapEvent(row);
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
      visibility: input.visibility ?? 'PUBLIC',
      publishedToWebsite:
        input.publishedToWebsite !== undefined
          ? Boolean(input.publishedToWebsite)
          : true,
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

  /**
   * Portal-facing events from PUBLISHED Academic Calendars (student / staff dashboards + mobile).
   * Filters by visibilityFlags; skips engine noise (WORKING_DAY / WEEKEND).
   */
  async listPortalEvents(
    tenantId: string,
    audience: 'students' | 'staff',
    from: Date,
    to: Date,
  ): Promise<
    Array<{
      id: string;
      date: string;
      type: 'exam' | 'holiday' | 'assignment' | 'fee' | 'event';
      title: string;
      subtitle?: string | null;
    }>
  > {
    const rows = await this.prisma.academicCalendarEvent.findMany({
      where: {
        tenantId,
        deletedAt: null,
        active: true,
        startDate: { lte: to },
        endDate: { gte: from },
        type: { notIn: ['WORKING_DAY', 'WEEKEND'] },
        calendar: {
          deletedAt: null,
          status: 'PUBLISHED',
        },
      },
      orderBy: [{ startDate: 'asc' }, { title: 'asc' }],
      take: 500,
      select: {
        id: true,
        type: true,
        title: true,
        description: true,
        startDate: true,
        endDate: true,
        visibility: true,
        visibilityFlags: true,
        venue: true,
      },
    });

    const out: Array<{
      id: string;
      date: string;
      type: 'exam' | 'holiday' | 'assignment' | 'fee' | 'event';
      title: string;
      subtitle?: string | null;
    }> = [];

    for (const row of rows) {
      if (
        !this.portalAudienceAllowed(
          row.visibilityFlags,
          audience,
          row.visibility,
        )
      ) {
        continue;
      }
      const startIso = toDateOnlyIso(row.startDate);
      const endIso = toDateOnlyIso(row.endDate);
      const rangeStart =
        startIso > toDateOnlyIso(from) ? startIso : toDateOnlyIso(from);
      const rangeEnd = endIso < toDateOnlyIso(to) ? endIso : toDateOnlyIso(to);
      // Emit one chip per day in the visible range (capped for long breaks).
      let cursor = parseDateOnly(rangeStart);
      const last = parseDateOnly(rangeEnd);
      let dayCount = 0;
      while (cursor.getTime() <= last.getTime() && dayCount < 31) {
        const dateIso = toDateOnlyIso(cursor);
        out.push({
          id: `academic-${row.id}-${dateIso}`,
          date: dateIso,
          type: this.portalTypeForAcademicEvent(row.type),
          title: row.title,
          subtitle:
            [statusLabelForType(row.type), row.venue?.trim() || null]
              .filter(Boolean)
              .join(' · ') || statusLabelForType(row.type),
        });
        cursor = new Date(cursor.getTime() + 86_400_000);
        dayCount += 1;
      }
    }

    return out;
  }

  private portalAudienceAllowed(
    flags: unknown,
    audience: 'students' | 'staff',
    visibility: string,
  ): boolean {
    const parsed =
      flags && typeof flags === 'object' && !Array.isArray(flags)
        ? (flags as CalendarVisibilityFlags)
        : {};
    if (audience === 'students') {
      if (typeof parsed.students === 'boolean') return parsed.students;
      // Default: PUBLIC always; INTERNAL allowed unless explicitly opted out
      return visibility === 'PUBLIC' || parsed.students !== false;
    }
    if (typeof parsed.staff === 'boolean') return parsed.staff;
    return visibility === 'PUBLIC' || parsed.staff !== false;
  }

  private portalTypeForAcademicEvent(
    type: string,
  ): 'exam' | 'holiday' | 'assignment' | 'fee' | 'event' {
    if (EXAM_TYPES.has(type) || type === 'HALL_TICKET' || type === 'RESULT') {
      return 'exam';
    }
    if (
      type.includes('HOLIDAY') ||
      type === 'WEATHER_CLOSURE' ||
      type === 'TEACHING_BREAK'
    ) {
      return 'holiday';
    }
    if (type === 'FEE_DUE' || type === 'FEE_FINE_START') return 'fee';
    return 'event';
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
    createdById?: string | null;
    updatedById?: string | null;
    createdAt: Date;
    updatedAt: Date;
    color?: string | null;
    icon?: string | null;
    venue?: string | null;
    isAllDay?: boolean;
    isRecurring?: boolean;
    recurrenceRule?: string | null;
    recurrenceParentId?: string | null;
    programmeId?: string | null;
    semesterId?: string | null;
    shiftId?: string | null;
    visibilityFlags?: unknown;
    attachmentUrls?: unknown;
    organizerName?: string | null;
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
      color: row.color ?? defaultColorForType(row.type),
      icon: row.icon ?? null,
      venue: row.venue ?? null,
      isAllDay: row.isAllDay ?? true,
      isRecurring: row.isRecurring ?? false,
      recurrenceRule: row.recurrenceRule ?? null,
      recurrenceParentId: row.recurrenceParentId ?? null,
      programmeId: row.programmeId ?? null,
      semesterId: row.semesterId ?? null,
      shiftId: row.shiftId ?? null,
      visibilityFlags:
        row.visibilityFlags && typeof row.visibilityFlags === 'object'
          ? (row.visibilityFlags as CalendarVisibilityFlags)
          : null,
      attachmentUrls: Array.isArray(row.attachmentUrls)
        ? (row.attachmentUrls as CalendarAttachmentMeta[])
        : [],
      organizerName: row.organizerName ?? null,
      createdById: row.createdById ?? null,
      updatedById: row.updatedById ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      readOnly: Boolean(row.sourceModule),
      occurrenceOf: null as string | null,
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
