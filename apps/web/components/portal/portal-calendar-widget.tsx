'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { GlassCard } from '@/components/erp/glass-card';
import {
  CALENDAR_EVENT_COLORS,
  eventsByDay,
  type PortalCalendarEvent,
} from '@/utils/portal-calendar';
import { cn } from '@/utils/cn';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type Props = {
  events?: PortalCalendarEvent[];
  loading?: boolean;
  title?: string;
};

export function PortalCalendarWidget({ events = [], loading, title = 'Calendar' }: Props) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const byDay = useMemo(() => eventsByDay(events), [events]);

  if (loading) {
    return (
      <GlassCard className="animate-pulse p-5">
        <div className="h-5 w-24 rounded bg-muted" />
        <div className="mt-4 h-40 rounded-xl bg-muted" />
      </GlassCard>
    );
  }

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleString('default', {
    month: 'long',
    year: 'numeric',
  });
  const todayKey = now.toISOString().slice(0, 10);
  const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth();

  const shiftMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  const upcoming = events
    .filter((e) => e.date >= todayKey)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);

  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted/60"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted/60"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{monthLabel}</p>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px]">
        {WEEKDAYS.map((d) => (
          <span key={d} className="py-1 font-medium text-muted-foreground">
            {d}
          </span>
        ))}
        {cells.map((day, i) => {
          if (!day) return <span key={i} className="py-1.5" />;
          const key = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dayEvents = byDay.get(key) ?? [];
          const isToday = isCurrentMonth && day === now.getDate() && key === todayKey;
          return (
            <span
              key={i}
              title={dayEvents.map((e) => e.title).join(', ')}
              className={cn(
                'relative rounded-md py-1.5',
                isToday ? 'bg-primary font-bold text-primary-foreground' : 'text-foreground/80',
              )}
            >
              {day}
              {dayEvents.length ? (
                <span className="absolute bottom-0.5 left-1/2 flex -translate-x-1/2 gap-0.5">
                  {dayEvents.slice(0, 3).map((e) => (
                    <span
                      key={e.id}
                      className={cn(
                        'h-1 w-1 rounded-full',
                        CALENDAR_EVENT_COLORS[e.type]?.dot ?? 'bg-primary',
                      )}
                    />
                  ))}
                </span>
              ) : null}
            </span>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {Object.entries(CALENDAR_EVENT_COLORS).map(([type, cfg]) => (
          <span key={type} className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className={cn('h-2 w-2 rounded-full', cfg.dot)} />
            {cfg.label}
          </span>
        ))}
      </div>

      {upcoming.length ? (
        <ul className="mt-4 space-y-2 border-t border-border/40 pt-3">
          {upcoming.map((e) => (
            <li key={e.id} className="flex items-start gap-2 text-xs">
              <span
                className={cn(
                  'mt-1 h-2 w-2 shrink-0 rounded-full',
                  CALENDAR_EVENT_COLORS[e.type]?.dot ?? 'bg-primary',
                )}
              />
              <div className="min-w-0">
                <p className="font-medium">{e.title}</p>
                <p className="text-muted-foreground">
                  {e.date}
                  {e.subtitle ? ` · ${e.subtitle}` : ''}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </GlassCard>
  );
}
