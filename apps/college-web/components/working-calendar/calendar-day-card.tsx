'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { StatusBadge } from './status-badge';
import { STATUS_STYLES, resolveDayVisual } from './status';
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
        className="min-h-[96px] rounded-2xl border border-dashed border-[#E5E7EB]/60 bg-[#F8FAFC]/50 p-3"
        aria-hidden={outsideMonth ? true : undefined}
      >
        {dateLabel ? <span className="text-sm font-medium text-[#94A3B8]">{dateLabel}</span> : null}
      </div>
    );
  }

  const visual = resolveDayVisual(day);
  const styles =
    visual.status === 'empty' ? null : STATUS_STYLES[visual.status as keyof typeof STATUS_STYLES];
  const eventPreview =
    visual.events[0] ?? (visual.title && visual.title !== visual.label ? visual.title : '');

  return (
    <motion.article
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={cn(
        'group flex min-h-[96px] flex-col rounded-2xl border border-[#E5E7EB] bg-white/90 p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] backdrop-blur-sm',
        'transition-shadow duration-250 hover:shadow-[0_10px_28px_rgba(30,58,138,0.10)] focus-within:ring-2 focus-within:ring-[#2563EB]/40',
        styles?.card,
      )}
      aria-label={`${day.date}, ${visual.label}${eventPreview ? `, ${eventPreview}` : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-base font-semibold tracking-tight text-[#1E293B]">
          {day.dayOfMonth}
        </span>
        <span className="text-[10px] font-medium uppercase tracking-wide text-[#94A3B8]">
          {day.dayOfWeek}
        </span>
      </div>
      <div className="mt-auto space-y-1.5 pt-3">
        {visual.status !== 'empty' ? (
          <StatusBadge status={visual.status} label={visual.label} />
        ) : null}
        {eventPreview ? (
          <p className="line-clamp-2 text-[11px] leading-snug text-[#64748B]">{eventPreview}</p>
        ) : null}
      </div>
    </motion.article>
  );
}

export const CalendarDayCard = memo(CalendarDayCardComponent);
