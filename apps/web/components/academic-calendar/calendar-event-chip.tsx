'use client';

import { Clock, MapPin } from 'lucide-react';

import { colorForType, eventChipSurface, formatClock } from '@/lib/academic-calendar-ui';
import type { AcademicCalendarEvent } from '@/services/academic-calendar';
import { cn } from '@/utils/cn';

type Props = {
  event: AcademicCalendarEvent;
  compact?: boolean;
  onClick?: (event: AcademicCalendarEvent) => void;
  onContextMenu?: (event: React.MouseEvent, ev: AcademicCalendarEvent) => void;
};

export function CalendarEventChip({ event, compact, onClick, onContextMenu }: Props) {
  const accent = colorForType(event.type, event.color);
  const time = event.isAllDay
    ? 'All day'
    : (formatClock(event.startTime) ?? (compact ? null : 'All day'));

  return (
    <button
      type="button"
      title={event.title}
      className={cn(
        'group w-full overflow-hidden rounded-lg border text-left shadow-sm transition',
        'hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50',
        eventChipSurface(event.type),
        compact ? 'px-1.5 py-1' : 'px-2 py-1.5',
      )}
      style={{ borderLeftWidth: 3, borderLeftColor: accent }}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(event);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu?.(e, event);
      }}
    >
      <p
        className={cn('truncate font-semibold leading-tight', compact ? 'text-[10px]' : 'text-xs')}
      >
        {event.icon ? <span className="mr-0.5">{event.icon}</span> : null}
        {event.title}
      </p>
      {!compact && time ? (
        <p className="mt-0.5 flex items-center gap-1 truncate text-[10px] opacity-80">
          <Clock className="h-2.5 w-2.5 shrink-0" />
          {time}
        </p>
      ) : null}
      {!compact && event.venue ? (
        <p className="mt-0.5 flex items-center gap-1 truncate text-[10px] opacity-70">
          <MapPin className="h-2.5 w-2.5 shrink-0" />
          {event.venue}
        </p>
      ) : null}
    </button>
  );
}
