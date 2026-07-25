import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  dayKindFromEvents,
  defaultCreatesAttendanceSession,
  defaultIsWorkingDayForType,
  parseDateOnly,
  toDateOnlyIso,
  type ResolvedDay,
} from './academic-calendar.types';

export type ResolveContext = {
  campusId?: string | null;
  departmentId?: string | null;
  /** Prefer a specific calendar; otherwise resolve against active year calendar. */
  calendarId?: string | null;
  academicYearId?: string | null;
};

type EventRow = {
  id: string;
  type: string;
  title: string;
  startDate: Date;
  endDate: Date;
  isWorkingDay: boolean | null;
  createsAttendanceSession: boolean;
  scopeType: string;
  campusId: string | null;
  departmentIds: unknown;
};

@Injectable()
export class WorkingDayEngineService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveDay(
    tenantId: string,
    dateInput: string | Date,
    ctx: ResolveContext = {},
  ): Promise<ResolvedDay> {
    const dateIso = toDateOnlyIso(dateInput);
    const date = parseDateOnly(dateIso);
    const calendar = await this.findCalendar(tenantId, date, ctx);
    const weekendDays = this.readWeekendDays(calendar?.weekendDays);
    const events = calendar
      ? await this.prisma.academicCalendarEvent.findMany({
          where: {
            tenantId,
            calendarId: calendar.id,
            active: true,
            deletedAt: null,
            startDate: { lte: date },
            endDate: { gte: date },
          },
          orderBy: [{ startDate: 'asc' }, { title: 'asc' }],
        })
      : [];
    return this.resolveWithEvents(dateIso, date, weekendDays, events, ctx);
  }

  async resolveRange(
    tenantId: string,
    fromIso: string,
    toIso: string,
    ctx: ResolveContext = {},
  ): Promise<ResolvedDay[]> {
    const from = parseDateOnly(fromIso);
    const to = parseDateOnly(toIso);
    const mid = new Date((from.getTime() + to.getTime()) / 2);
    const calendar = await this.findCalendar(tenantId, mid, ctx);
    const weekendDays = this.readWeekendDays(calendar?.weekendDays);
    const events: EventRow[] = calendar
      ? await this.prisma.academicCalendarEvent.findMany({
          where: {
            tenantId,
            calendarId: calendar.id,
            active: true,
            deletedAt: null,
            startDate: { lte: to },
            endDate: { gte: from },
          },
          orderBy: [{ startDate: 'asc' }, { title: 'asc' }],
        })
      : [];

    const out: ResolvedDay[] = [];
    for (
      let cursor = new Date(from.getTime());
      cursor.getTime() <= to.getTime();
      cursor = new Date(cursor.getTime() + 86_400_000)
    ) {
      const dateIso = toDateOnlyIso(cursor);
      const dayEvents = events.filter(
        (e) =>
          e.startDate.getTime() <= cursor.getTime() &&
          e.endDate.getTime() >= cursor.getTime(),
      );
      out.push(
        this.resolveWithEvents(dateIso, cursor, weekendDays, dayEvents, ctx),
      );
    }
    return out;
  }

  private resolveWithEvents(
    dateIso: string,
    date: Date,
    weekendDays: number[],
    events: EventRow[],
    ctx: ResolveContext,
  ): ResolvedDay {
    const weekday = date.getUTCDay();
    const isWeekend = weekendDays.includes(weekday);
    const scoped = events.filter((event) => this.matchesScope(event, ctx));

    let isWorkingDay = !isWeekend;
    let createsAttendanceSession = false;

    if (scoped.length) {
      const classEvents = scoped.filter((e) =>
        ['HOLIDAY_CLASS', 'COMPENSATORY_CLASS', 'MAKEUP_CLASS'].includes(
          e.type,
        ),
      );
      const holidayEvents = scoped.filter((e) =>
        [
          'NATIONAL_HOLIDAY',
          'STATE_HOLIDAY',
          'COLLEGE_HOLIDAY',
          'RESTRICTED_HOLIDAY',
          'EMERGENCY_HOLIDAY',
          'WEATHER_CLOSURE',
          'WEEKEND',
          'TEACHING_BREAK',
        ].includes(e.type),
      );

      if (classEvents.length) {
        isWorkingDay = classEvents.some(
          (e) => e.isWorkingDay ?? defaultIsWorkingDayForType(e.type),
        );
        createsAttendanceSession = classEvents.some(
          (e) =>
            e.createsAttendanceSession ||
            defaultCreatesAttendanceSession(e.type),
        );
      } else if (holidayEvents.length) {
        if (
          holidayEvents.some(
            (e) => !(e.isWorkingDay ?? defaultIsWorkingDayForType(e.type)),
          )
        ) {
          isWorkingDay = false;
        } else {
          isWorkingDay = holidayEvents.every((e) =>
            e.isWorkingDay == null
              ? defaultIsWorkingDayForType(e.type)
              : e.isWorkingDay,
          );
        }
      } else {
        const withOverride = scoped.filter((e) => e.isWorkingDay != null);
        if (withOverride.length) {
          isWorkingDay = withOverride.some((e) => Boolean(e.isWorkingDay));
        }
        createsAttendanceSession = scoped.some(
          (e) => e.createsAttendanceSession,
        );
      }
    }

    const dayKind = dayKindFromEvents(
      isWeekend,
      scoped.map((e) => ({ type: e.type, isWorkingDay: e.isWorkingDay })),
      isWorkingDay,
    );

    return {
      date: dateIso,
      isWorkingDay,
      dayKind,
      createsAttendanceSession,
      events: scoped.map((e) => ({ id: e.id, type: e.type, title: e.title })),
    };
  }

  private async findCalendar(
    tenantId: string,
    date: Date,
    ctx: ResolveContext,
  ) {
    if (ctx.calendarId) {
      return this.prisma.academicCalendar.findFirst({
        where: { id: ctx.calendarId, tenantId, deletedAt: null },
      });
    }
    if (ctx.academicYearId) {
      return this.prisma.academicCalendar.findFirst({
        where: {
          tenantId,
          academicYearId: ctx.academicYearId,
          deletedAt: null,
        },
      });
    }
    const covering = await this.prisma.academicCalendar.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        status: 'PUBLISHED',
        academicYear: {
          startDate: { lte: date },
          endDate: { gte: date },
          deletedAt: null,
        },
      },
      orderBy: { publishedAt: 'desc' },
    });
    if (covering) return covering;
    return this.prisma.academicCalendar.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        academicYear: {
          startDate: { lte: date },
          endDate: { gte: date },
          deletedAt: null,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  private readWeekendDays(value: unknown): number[] {
    if (Array.isArray(value)) {
      return value.map((n) => Number(n)).filter((n) => Number.isFinite(n));
    }
    return [0];
  }

  private matchesScope(
    event: {
      scopeType: string;
      campusId: string | null;
      departmentIds: unknown;
    },
    ctx: ResolveContext,
  ) {
    if (event.scopeType === 'INSTITUTION' || !event.scopeType) return true;
    if (event.scopeType === 'CAMPUS') {
      if (!ctx.campusId) return true;
      return !event.campusId || event.campusId === ctx.campusId;
    }
    if (event.scopeType === 'DEPARTMENT') {
      if (!ctx.departmentId) return true;
      const ids = Array.isArray(event.departmentIds)
        ? (event.departmentIds as unknown[]).map(String)
        : [];
      if (!ids.length) return true;
      return ids.includes(ctx.departmentId);
    }
    return true;
  }
}
