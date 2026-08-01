'use client';

import { motion } from 'framer-motion';
import { ArrowRight, CalendarDays, Clock, MapPin, User } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  colorForType,
  eventChipSurface,
  formatClock,
  formatDayBadge,
  formatDisplayDate,
} from '@/lib/academic-calendar-ui';
import type { AcademicCalendarEvent } from '@/services/academic-calendar';
import { cn } from '@/utils/cn';

type Props = {
  todayIso: string;
  todayEvents: AcademicCalendarEvent[];
  upcomingEvents: AcademicCalendarEvent[];
  viewYear: number;
  viewMonth: number;
  eventDates: Set<string>;
  selectedDay: string;
  onSelectDay: (iso: string) => void;
  onOpenEvent: (event: AcademicCalendarEvent) => void;
  onCreateEvent?: () => void;
};

function MiniMonth({
  viewYear,
  viewMonth,
  todayIso,
  selectedDay,
  eventDates,
  onSelectDay,
}: {
  viewYear: number;
  viewMonth: number;
  todayIso: string;
  selectedDay: string;
  eventDates: Set<string>;
  onSelectDay: (iso: string) => void;
}) {
  const last = new Date(Date.UTC(viewYear, viewMonth, 0)).getUTCDate();
  const leading = new Date(Date.UTC(viewYear, viewMonth - 1, 1)).getUTCDay();
  const label = new Date(Date.UTC(viewYear, viewMonth - 1, 1)).toLocaleString(undefined, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-sky-600" />
        <p className="text-sm font-semibold text-slate-800">{label}</p>
      </div>
      <div className="mb-1 grid grid-cols-7 text-center text-[10px] font-semibold uppercase text-slate-400">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={d + '-' + i}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: leading }).map((_, i) => (
          <div key={'m-blank-' + i} />
        ))}
        {Array.from({ length: last }).map((_, i) => {
          const day = i + 1;
          const iso =
            viewYear +
            '-' +
            String(viewMonth).padStart(2, '0') +
            '-' +
            String(day).padStart(2, '0');
          const isToday = iso === todayIso;
          const isSelected = iso === selectedDay;
          const hasEvents = eventDates.has(iso);
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelectDay(iso)}
              className={cn(
                'relative flex h-8 items-center justify-center rounded-full text-xs font-medium',
                isToday && 'bg-sky-600 text-white',
                !isToday && isSelected && 'bg-sky-100 text-sky-800',
                !isToday && !isSelected && 'text-slate-700 hover:bg-slate-100',
              )}
            >
              {day}
              {hasEvents && !isToday ? (
                <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-sky-500" />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CalendarBottomPanels({
  todayIso,
  todayEvents,
  upcomingEvents,
  viewYear,
  viewMonth,
  eventDates,
  selectedDay,
  onSelectDay,
  onOpenEvent,
  onCreateEvent,
}: Props) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <section className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">
            Today&apos;s Events ({todayEvents.length})
          </h3>
          <span className="text-xs text-slate-500">{formatDisplayDate(todayIso)}</span>
        </div>
        <div className="space-y-2">
          {todayEvents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#E5E7EB] bg-[#F8FAFC] px-4 py-8 text-center">
              <p className="text-sm text-slate-500">No events scheduled today.</p>
              {onCreateEvent ? (
                <Button size="sm" className="mt-3 rounded-xl" onClick={onCreateEvent}>
                  Create Event
                </Button>
              ) : null}
            </div>
          ) : (
            todayEvents.map((ev, index) => (
              <motion.div
                key={ev.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.04 }}
                className={cn('rounded-xl border p-3', eventChipSurface(ev.type))}
                style={{
                  borderLeftWidth: 3,
                  borderLeftColor: colorForType(ev.type, ev.color),
                }}
              >
                <p className="font-semibold text-sm">{ev.title}</p>
                <div className="mt-1 space-y-0.5 text-xs opacity-80">
                  <p className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {ev.isAllDay ? 'All day' : (formatClock(ev.startTime) ?? 'Time TBA')}
                    {ev.endTime ? ` – ${formatClock(ev.endTime)}` : ''}
                  </p>
                  {ev.venue ? (
                    <p className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {ev.venue}
                    </p>
                  ) : null}
                  {ev.organizerName ? (
                    <p className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {ev.organizerName}
                    </p>
                  ) : null}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-2 h-8 rounded-lg px-2 text-xs"
                  onClick={() => onOpenEvent(ev)}
                >
                  View Details
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </motion.div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-800">Upcoming Events (Next 7 Days)</h3>
        <div className="space-y-3">
          {upcomingEvents.length === 0 ? (
            <p className="text-sm text-slate-500">No upcoming events.</p>
          ) : (
            upcomingEvents.map((ev) => {
              const badge = formatDayBadge(ev.startDate);
              return (
                <button
                  key={ev.id}
                  type="button"
                  className="flex w-full items-start gap-3 rounded-xl border border-[#E5E7EB] p-2.5 text-left transition hover:border-sky-200 hover:bg-sky-50/40"
                  onClick={() => onOpenEvent(ev)}
                >
                  <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-[#F8FAFC] text-center">
                    <span className="text-[10px] font-semibold text-sky-600">{badge.mon}</span>
                    <span className="text-base font-bold text-slate-800">{badge.day}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{ev.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {ev.isAllDay ? 'All day' : (formatClock(ev.startTime) ?? 'Time TBA')}
                      {ev.venue ? ` · ${ev.venue}` : ''}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </section>

      <MiniMonth
        viewYear={viewYear}
        viewMonth={viewMonth}
        todayIso={todayIso}
        selectedDay={selectedDay}
        eventDates={eventDates}
        onSelectDay={onSelectDay}
      />
    </div>
  );
}
