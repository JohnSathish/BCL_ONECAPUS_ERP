'use client';

import Link from 'next/link';
import { Clock, MapPin } from 'lucide-react';

import { GlassCard } from '@/components/erp/glass-card';
import { buttonVariants } from '@/components/ui/button';
import type { StaffTimetableSlot } from '@/types/staff-portal';
import { cn } from '@/utils/cn';
import { isCurrentTimeSlot, isPastTimeSlot } from '@/utils/student-portal-utils';

export function TodayScheduleWidget({
  schedule,
  loading,
}: {
  schedule?: StaffTimetableSlot[];
  loading?: boolean;
}) {
  if (loading) {
    return (
      <GlassCard className="animate-pulse p-6 lg:col-span-2">
        <div className="h-5 w-40 rounded bg-muted" />
        <div className="mt-4 space-y-3">
          <div className="h-16 rounded-xl bg-muted" />
          <div className="h-16 rounded-xl bg-muted" />
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-5 lg:col-span-2" glow>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold tracking-tight">Today&apos;s Schedule</h3>
        <Link href="/staff/academic/timetable" className="text-xs text-primary hover:underline">
          Full timetable
        </Link>
      </div>

      {!schedule?.length ? (
        <p className="mt-6 text-sm text-muted-foreground">No classes scheduled for today.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {schedule.map((slot) => {
            const isCurrent = isCurrentTimeSlot(slot.startTime, slot.endTime);
            const isPast = isPastTimeSlot(slot.endTime);
            return (
              <li
                key={slot.id}
                className={cn(
                  'flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between',
                  isCurrent
                    ? 'border-primary/40 bg-primary/5 shadow-[0_0_20px_hsl(var(--primary)/0.12)]'
                    : isPast
                      ? 'border-border/30 bg-background/20 opacity-60'
                      : 'border-border/50 bg-background/40',
                )}
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {slot.startTime}–{slot.endTime}
                  </p>
                  <p className="mt-1 font-semibold">{slot.subject}</p>
                  <p className="text-xs text-muted-foreground">
                    {slot.semesterNo ? `Sem ${slot.semesterNo}` : '—'}
                    {slot.sectionCode ? ` · Section ${slot.sectionCode}` : ''}
                  </p>
                  {slot.classroom ? (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {slot.classroom}
                    </p>
                  ) : null}
                </div>
                {slot.offeringSectionId ? (
                  <Link
                    href={`/staff/academic/attendance-entry?section=${slot.offeringSectionId}`}
                    className={cn(buttonVariants({ size: 'sm' }), 'shrink-0 rounded-xl text-xs')}
                  >
                    {isCurrent ? 'Take Attendance — Now' : 'Take Attendance'}
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </GlassCard>
  );
}
