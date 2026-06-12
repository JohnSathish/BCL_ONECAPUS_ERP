'use client';

import Link from 'next/link';
import { Clock } from 'lucide-react';

import { GlassCard } from '@/components/erp/glass-card';
import { buttonVariants } from '@/components/ui/button';
import type { StudentTimetableSlot } from '@/types/student-portal';
import { cn } from '@/utils/cn';

export function TodayTimetableWidget({
  schedule,
  loading,
}: {
  schedule?: StudentTimetableSlot[];
  loading?: boolean;
}) {
  if (loading) {
    return (
      <GlassCard className="animate-pulse p-6 lg:col-span-2">
        <div className="h-5 w-40 rounded bg-muted" />
        <div className="mt-4 space-y-3">
          <div className="h-14 rounded-xl bg-muted" />
          <div className="h-14 rounded-xl bg-muted" />
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-5 lg:col-span-2" glow>
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">Today&apos;s Timetable</h3>
          <p className="text-xs text-muted-foreground">Current period highlighted</p>
        </div>
        <Link href="/student/timetable" className="text-xs text-primary hover:underline">
          Full week
        </Link>
      </div>

      {!schedule?.length ? (
        <p className="mt-6 rounded-xl border border-dashed border-border/60 px-4 py-8 text-center text-sm text-muted-foreground">
          No classes scheduled for today. Check your full week timetable once registration is
          confirmed.
        </p>
      ) : (
        <ul className="mt-4 space-y-0 md:space-y-2">
          {schedule.map((slot) => {
            const title = slot.course?.title ?? slot.course?.code ?? 'Class';
            return (
              <li
                key={slot.id}
                className={cn(
                  'relative flex gap-3 border-l-2 py-3 pl-4 md:rounded-xl md:border md:border-border/50 md:border-l-2 md:p-4',
                  slot.isCurrent
                    ? 'border-l-primary bg-primary/5 md:border-primary/40 md:shadow-[0_0_20px_hsl(var(--primary)/0.12)]'
                    : slot.isPast
                      ? 'border-l-muted opacity-60'
                      : 'border-l-border/60',
                )}
              >
                {slot.isCurrent ? (
                  <span className="absolute -left-[5px] top-4 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-primary/20 md:top-5" />
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {slot.startTime}
                    {slot.endTime ? ` – ${slot.endTime}` : ''}
                  </p>
                  <p className="mt-0.5 font-semibold">{title}</p>
                  {slot.fyugpCategory ? (
                    <p className="text-xs text-muted-foreground">{slot.fyugpCategory}</p>
                  ) : null}
                </div>
                {slot.isCurrent ? (
                  <span
                    className={cn(
                      buttonVariants({ size: 'sm', variant: 'secondary' }),
                      'hidden shrink-0 self-center rounded-xl text-xs sm:inline-flex',
                    )}
                  >
                    Now
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </GlassCard>
  );
}
