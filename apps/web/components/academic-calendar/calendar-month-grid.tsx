'use client';

import { motion } from 'framer-motion';

import { CalendarEventChip } from '@/components/academic-calendar/calendar-event-chip';
import { dayCellSurface, dayKindBadge } from '@/lib/academic-calendar-ui';
import type { AcademicCalendarEvent } from '@/services/academic-calendar';
import { cn } from '@/utils/cn';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type DayMeta = {
  date: string;
  dayKind?: string;
};

type Props = {
  viewYear: number;
  viewMonth: number;
  lastDay: number;
  leadingBlanks: number;
  todayIso: string;
  selectedDay: string;
  dayMap: Map<string, DayMeta>;
  eventsByDate: Map<string, AcademicCalendarEvent[]>;
  onSelectDay: (iso: string) => void;
  onAddDay: (iso: string) => void;
  onOpenEvent: (event: AcademicCalendarEvent) => void;
  onMore: (iso: string) => void;
  onContextMenu: (args: {
    x: number;
    y: number;
    date: string;
    event?: AcademicCalendarEvent;
  }) => void;
};

function toIso(year: number, month: number, day: number) {
  return year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}

export function CalendarMonthGrid({
  viewYear,
  viewMonth,
  lastDay,
  leadingBlanks,
  todayIso,
  selectedDay,
  dayMap,
  eventsByDate,
  onSelectDay,
  onAddDay,
  onOpenEvent,
  onMore,
  onContextMenu,
}: Props) {
  const blankCells = Array.from({ length: leadingBlanks }, (_, i) => i);
  const monthDays = Array.from({ length: lastDay }, (_, i) => i + 1);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-1 py-3">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-slate-200">
        {blankCells.map((i) => (
          <div key={'blank-' + i} className="min-h-[7.375rem] bg-slate-50" />
        ))}
        {monthDays.map((day) => {
          const iso = toIso(viewYear, viewMonth, day);
          const resolved = dayMap.get(iso);
          const dayEvents = eventsByDate.get(iso) ?? [];
          const shown = dayEvents.slice(0, 3);
          const more = dayEvents.length - shown.length;
          const isToday = iso === todayIso;
          const isSelected = iso === selectedDay;
          const badge = dayKindBadge(resolved?.dayKind);

          return (
            <motion.div
              key={iso}
              whileHover={{ y: -1 }}
              className={cn(
                'min-h-[7.375rem] cursor-pointer bg-white p-2 transition',
                dayCellSurface(resolved?.dayKind, isToday),
                isSelected && !isToday ? 'ring-2 ring-inset ring-sky-300' : '',
              )}
              onClick={() => {
                onSelectDay(iso);
              }}
              onDoubleClick={() => onAddDay(iso)}
              onContextMenu={(e) => {
                e.preventDefault();
                onContextMenu({ x: e.clientX, y: e.clientY, date: iso });
              }}
            >
              <div className="mb-1.5 flex items-start justify-between gap-1">
                <span
                  className={cn(
                    'inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold',
                    isToday ? 'bg-sky-600 text-white' : 'text-slate-800',
                  )}
                >
                  {day}
                </span>
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
                    badge.className,
                  )}
                >
                  {badge.label}
                </span>
              </div>
              <div className="space-y-1">
                {shown.map((ev) => (
                  <CalendarEventChip
                    key={ev.id}
                    event={ev}
                    compact
                    onClick={onOpenEvent}
                    onContextMenu={(e, event) =>
                      onContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        date: iso,
                        event,
                      })
                    }
                  />
                ))}
                {more > 0 ? (
                  <button
                    type="button"
                    className="w-full rounded-md px-1 py-0.5 text-left text-[10px] font-semibold text-sky-700 hover:bg-sky-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMore(iso);
                    }}
                  >
                    +{more} more
                  </button>
                ) : null}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
