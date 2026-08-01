'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { StatusBadge } from './status-badge';
import { STATUS_STYLES, eventChipClass, resolveDayVisual } from './status';
import type { WorkingCalendarDay } from './types';

type Props = {
  day?: WorkingCalendarDay | null;
  outsideMonth?: boolean;
  dateLabel?: number;
};

function CalendarDayCardComponent({ day, outsideMonth, dateLabel }: Props) {
  if (!day || outsideMonth) {
    return (
      <div
        className="min-h-[112px] rounded-2xl border border-dashed border-[#E5E7EB]/60 bg-[#F8FAFC]/50 p-2.5"
        aria-hidden={outsideMonth ? true : undefined}
      >
        {dateLabel ? <span className="text-sm font-medium text-[#94A3B8]">{dateLabel}</span> : null}
      </div>
    );
  }

  const visual = resolveDayVisual(day);
  const styles =
    visual.status === 'empty' ? null : STATUS_STYLES[visual.status as keyof typeof STATUS_STYLES];
  const eventLines = visual.events.slice(0, 3);
  const extraEvents = visual.events.length - eventLines.length;

  return (
    <motion.article
      whileHover={{ scale: 1.015 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={cn(
        'group flex min-h-[112px] flex-col rounded-2xl border border-[#E5E7EB] bg-white/95 p-2.5',
        'transition-shadow duration-200 hover:shadow-[0_10px_28px_rgba(30,58,138,0.10)] focus-within:ring-2 focus-within:ring-[#2563EB]/40',
        styles?.card,
      )}
      aria-label={`${day.date}, ${visual.label}${
        eventLines.length ? `, ${eventLines.map((e) => e.title).join(', ')}` : ''
      }`}
    >
      <div className="mb-1.5 flex items-start justify-between gap-1">
        <span className="inline-flex h-7 w-7 items-center justify-center text-sm font-bold text-[#1E293B]">
          {day.dayOfMonth}
        </span>
        {visual.status !== 'empty' ? (
          <StatusBadge status={visual.status} label={visual.label.toUpperCase()} compact />
        ) : null}
      </div>

      <div className="mt-auto space-y-1">
        {eventLines.map((event) => (
          <p
            key={`${day.date}-${event.title}`}
            className={cn(
              'truncate rounded-md border px-1.5 py-0.5 text-[10px] font-semibold leading-tight',
              eventChipClass(event.type),
            )}
            title={event.title}
          >
            {event.title}
          </p>
        ))}
        {extraEvents > 0 ? (
          <p className="text-[10px] font-semibold text-[#2563EB]">+{extraEvents} more</p>
        ) : null}
      </div>
    </motion.article>
  );
}

export const CalendarDayCard = memo(CalendarDayCardComponent);
