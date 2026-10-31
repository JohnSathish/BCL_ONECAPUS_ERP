import { BadRequestException, Injectable } from '@nestjs/common';
import { WorkingDayEngineService } from '../../academic-calendar/working-day-engine.service';
import { PrismaService } from '../../../database/prisma.service';
import { parseDateOnly } from '../../academic-calendar/academic-calendar.types';
import {
  mergeCirculationPolicy,
  type LoanCalendarPolicy,
} from '../domain/library-policy.types';
import {
  addCalendarDays,
  addWorkingDays,
  collegeDateIso,
  endOfCollegeDate,
  fineFromOverdueDays,
  isHolidayClosure,
  isLoanDayClosed,
  overdueWorkingDays,
  type HolidayDay,
} from '../domain/library-loan-calendar.logic';
import type { FineCalculationSettings } from '../utils/library-fine.util';
import { LibrarySettingsService } from './library-settings.service';

export type LoanDateAssessment = {
  overdueDays: number;
  fine: number;
  dueIso: string;
  asOfIso: string;
};

@Injectable()
export class LibraryLoanCalendarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workingDays: WorkingDayEngineService,
    private readonly settings: LibrarySettingsService,
  ) {}

  async policy(tenantId: string): Promise<LoanCalendarPolicy> {
    const stored = await this.settings.getSettings(tenantId);
    return mergeCirculationPolicy(stored.circulationPolicy).loanCalendar;
  }

  /** Due date after `workingDays` college working days. The start date is not counted. */
  async dueAt(
    tenantId: string,
    from: Date,
    workingDays: number,
  ): Promise<Date> {
    const rules = await this.policy(tenantId);
    const startIso = collegeDateIso(from);
    if (workingDays < 1) return endOfCollegeDate(startIso);
    if (!rules.excludeWeekends && !rules.excludeHolidays) {
      return endOfCollegeDate(addCalendarDays(startIso, workingDays));
    }
    const weekendDays = rules.excludeWeekends
      ? await this.weekendDays(tenantId, parseDateOnly(startIso))
      : [];
    let horizon = Math.max(workingDays * 3 + 60, 90);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const endIso = addCalendarDays(startIso, horizon);
      const holidays = rules.excludeHolidays
        ? await this.holidayDates(tenantId, startIso, endIso)
        : new Set<string>();
      const closed = (iso: string) =>
        isLoanDayClosed(
          iso,
          {
            excludeWeekends: rules.excludeWeekends,
            excludeHolidays: rules.excludeHolidays,
            weekendDays,
          },
          holidays,
        );
      try {
        const dueIso = addWorkingDays(startIso, workingDays, closed, horizon);
        if (dueIso <= endIso) return endOfCollegeDate(dueIso);
      } catch (error) {
        if (!(error instanceof Error) || error.message !== 'LOAN_WINDOW')
          throw error;
      }
      horizon *= 2;
    }
    throw new BadRequestException(
      'The due date could not be calculated from the academic calendar.',
    );
  }

  async assess(
    tenantId: string,
    dueAt: Date,
    asOf: Date,
    settings: FineCalculationSettings,
  ): Promise<LoanDateAssessment> {
    const [result] = await this.assessMany(
      tenantId,
      [{ dueAt }],
      asOf,
      settings,
    );
    return result;
  }

  async assessMany(
    tenantId: string,
    loans: Array<{ dueAt: Date }>,
    asOf: Date,
    settings: FineCalculationSettings,
  ): Promise<LoanDateAssessment[]> {
    const asOfIso = collegeDateIso(asOf);
    if (!loans.length) return [];
    const dueIsos = loans.map((loan) => collegeDateIso(loan.dueAt));
    const rules = await this.policy(tenantId);
    const fromIso = dueIsos.reduce(
      (left, right) => (left < right ? left : right),
      asOfIso,
    );
    const toIso = dueIsos.reduce(
      (left, right) => (left > right ? left : right),
      asOfIso,
    );
    const closed = await this.closedPredicate(tenantId, fromIso, toIso, rules);
    const rate = Number(settings.finePerDay);
    const cap = Number(settings.maxFine);
    const grace = settings.graceDays;
    return dueIsos.map((dueIso) => {
      const overdueDays = overdueWorkingDays(dueIso, asOfIso, grace, closed);
      return {
        overdueDays,
        fine: fineFromOverdueDays(overdueDays, rate, cap),
        dueIso,
        asOfIso,
      };
    });
  }

  private async closedPredicate(
    tenantId: string,
    fromIso: string,
    toIso: string,
    rules: LoanCalendarPolicy,
  ) {
    const start = fromIso <= toIso ? fromIso : toIso;
    const end = fromIso <= toIso ? toIso : fromIso;
    if (!rules.excludeWeekends && !rules.excludeHolidays) {
      return () => false;
    }
    const weekendDays = rules.excludeWeekends
      ? await this.weekendDays(tenantId, parseDateOnly(start))
      : [];
    const holidays = rules.excludeHolidays
      ? await this.holidayDates(tenantId, start, end)
      : new Set<string>();
    return (iso: string) =>
      isLoanDayClosed(
        iso,
        {
          excludeWeekends: rules.excludeWeekends,
          excludeHolidays: rules.excludeHolidays,
          weekendDays,
        },
        holidays,
      );
  }

  private async holidayDates(tenantId: string, fromIso: string, toIso: string) {
    const days = await this.workingDays.resolveRange(tenantId, fromIso, toIso);
    const closed = new Set<string>();
    for (const day of days) {
      if (isHolidayClosure(day as HolidayDay))
        closed.add(day.date.slice(0, 10));
    }
    return closed;
  }

  private async weekendDays(tenantId: string, on: Date): Promise<number[]> {
    const calendar = await this.prisma.academicCalendar.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        status: 'PUBLISHED',
        academicYear: {
          startDate: { lte: on },
          endDate: { gte: on },
          deletedAt: null,
        },
      },
      orderBy: { publishedAt: 'desc' },
      select: { weekendDays: true },
    });
    const value = calendar?.weekendDays;
    if (Array.isArray(value)) {
      return value
        .map((day) => Number(day))
        .filter((day) => Number.isFinite(day) && day >= 0 && day <= 6);
    }
    return [0];
  }
}
