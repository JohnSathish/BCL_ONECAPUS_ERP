'use client';

import { useMemo } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { CalendarGrid } from './calendar-grid';
import { EventsCard } from './events-card';
import { LegendCard } from './legend-card';
import { MonthNavigation } from './month-navigation';
import { parseDayEventTitles, summarizeMonth } from './status';
import { SummaryCard } from './summary-card';
import type { WorkingCalendarMonth } from './types';

type Props = {
  months: WorkingCalendarMonth[];
  active: WorkingCalendarMonth;
  hrefForMonth?: (key: string) => string;
};

export function WorkingCalendar({
  months,
  active,
  hrefForMonth = (key) => `/academics/calendar?month=${key}`,
}: Props) {
  const summary = useMemo(() => summarizeMonth(active.days), [active.days]);
  const events = useMemo(
    () =>
      active.days.flatMap((day) =>
        parseDayEventTitles(day.description).map((title) => ({
          date: day.date,
          dayOfMonth: day.dayOfMonth,
          title,
        })),
      ),
    [active.days],
  );

  const activeIndex = months.findIndex((month) => month.key === active.key);
  const prev = activeIndex > 0 ? months[activeIndex - 1] : null;
  const next = activeIndex >= 0 && activeIndex < months.length - 1 ? months[activeIndex + 1] : null;

  return (
    <div className="space-y-5">
      <MonthNavigation months={months} activeKey={active.key} hrefForMonth={hrefForMonth} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          {prev ? (
            <Link
              href={hrefForMonth(prev.key)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#1E293B] transition hover:border-[#2563EB]/40 hover:bg-[#EFF6FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
              aria-label={`Previous month: ${prev.title}`}
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
          ) : (
            <span
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-transparent text-[#CBD5E1]"
              aria-hidden
            >
              <ChevronLeft className="h-4 w-4" />
            </span>
          )}
          <div className="flex items-center gap-2 px-1">
            <CalendarDays className="h-5 w-5 text-[#1E3A8A]" aria-hidden />
            <h2 className="text-xl font-semibold tracking-tight text-[#1E293B]">{active.title}</h2>
          </div>
          {next ? (
            <Link
              href={hrefForMonth(next.key)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#1E293B] transition hover:border-[#2563EB]/40 hover:bg-[#EFF6FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
              aria-label={`Next month: ${next.title}`}
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <span
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-transparent text-[#CBD5E1]"
              aria-hidden
            >
              <ChevronRight className="h-4 w-4" />
            </span>
          )}
        </div>

        <div className="inline-flex items-center gap-2 rounded-2xl bg-[#1E3A8A] px-4 py-3 text-white shadow-[0_10px_28px_rgba(30,58,138,0.28)]">
          <CalendarDays className="h-4 w-4 opacity-90" aria-hidden />
          <span className="text-sm font-medium">Working Days</span>
          <strong className="text-lg font-bold leading-none">{summary.workingDays}</strong>
        </div>
      </div>

      <CalendarGrid year={active.year} month={active.month} days={active.days} />

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="space-y-4">
          <LegendCard />
          <SummaryCard
            workingDays={summary.workingDays}
            weekends={summary.weekends}
            publicHolidays={summary.publicHolidays}
            optionalHolidays={summary.optionalHolidays}
          />
        </div>
        <EventsCard events={events} />
      </div>
    </div>
  );
}
