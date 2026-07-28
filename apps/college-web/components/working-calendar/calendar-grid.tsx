'use client';

import { useMemo } from 'react';
import { CalendarDayCard } from './calendar-day-card';
import type { WorkingCalendarDay } from './types';

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

type Props = {
  year: number;
  month: number;
  days: WorkingCalendarDay[];
};

export function CalendarGrid({ year, month, days }: Props) {
  const cells = useMemo(() => {
    const byDate = new Map(days.map((day) => [day.date, day]));
    const first = new Date(Date.UTC(year, month - 1, 1));
    const startPad = first.getUTCDay();
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const total = Math.ceil((startPad + daysInMonth) / 7) * 7;
    const result: Array<{
      key: string;
      day: WorkingCalendarDay | null;
      outside: boolean;
      label?: number;
    }> = [];

    for (let i = 0; i < total; i += 1) {
      const dayNumber = i - startPad + 1;
      if (dayNumber < 1 || dayNumber > daysInMonth) {
        const outsideDate = new Date(Date.UTC(year, month - 1, dayNumber));
        result.push({
          key: `pad-${i}`,
          day: null,
          outside: true,
          label: outsideDate.getUTCDate(),
        });
        continue;
      }
      const date = `${year}-${String(month).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
      const matched = byDate.get(date);
      const weekday = WEEKDAYS[new Date(`${date}T12:00:00Z`).getUTCDay()] ?? 'MON';
      result.push({
        key: date,
        day:
          matched ??
          ({
            id: date,
            date,
            dayOfWeek: weekday,
            dayOfMonth: dayNumber,
            statusLabel: '',
            description: '',
            isWorkingDay: false,
            isHighlighted: false,
          } satisfies WorkingCalendarDay),
        outside: false,
      });
    }
    return result;
  }, [days, month, year]);

  return (
    <div className="overflow-hidden rounded-[16px] border border-[#E5E7EB] bg-white shadow-[0_10px_40px_rgba(15,23,42,0.05)]">
      <div className="hidden grid-cols-7 bg-[#1E3A8A] lg:grid">
        {WEEKDAYS.map((label) => (
          <div
            key={label}
            className="px-2 py-3 text-center text-[11px] font-semibold tracking-[0.14em] text-white"
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-2 bg-[#F8FAFC] p-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
        {cells.map((cell) => (
          <div key={cell.key} className={cell.outside ? 'hidden lg:block' : undefined}>
            <CalendarDayCard
              day={cell.outside ? null : cell.day}
              outsideMonth={cell.outside}
              dateLabel={cell.label}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
