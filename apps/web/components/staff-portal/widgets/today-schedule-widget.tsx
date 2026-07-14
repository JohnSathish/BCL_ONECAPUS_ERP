'use client';

import Link from 'next/link';
import { Clock, MapPin } from 'lucide-react';

import { GlassCard } from '@/components/erp/glass-card';
import { buttonVariants } from '@/components/ui/button';
import type { StaffTimetableSlot } from '@/types/staff-portal';
import { cn } from '@/utils/cn';
import { isCurrentTimeSlot, isPastTimeSlot } from '@/utils/student-portal-utils';

function groupByShift(schedule: StaffTimetableSlot[]) {
  const map = new Map<string, StaffTimetableSlot[]>();
  for (const slot of schedule) {
    const key = slot.shiftName ?? slot.shiftCode ?? 'Classes';
    const list = map.get(key) ?? [];
    list.push(slot);
    map.set(key, list);
  }
  return Array.from(map.entries());
}

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

  const groups = schedule?.length ? groupByShift(schedule) : [];
  const multiShift = groups.length > 1;

  return (
    <GlassCard className="p-5 lg:col-span-2" glow>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold tracking-tight">Today&apos;s Classes</h3>
        <Link href="/staff/academic/timetable" className="text-xs text-primary hover:underline">
          Full timetable
        </Link>
      </div>

      {!schedule?.length ? (
        <p className="mt-6 text-sm text-muted-foreground">No classes scheduled for today.</p>
      ) : (
        <div className="mt-4 space-y-5">
          {groups.map(([shiftLabel, slots]) => (
            <div key={shiftLabel}>
              {multiShift || slots.some((s) => s.shiftName || s.shiftCode) ? (
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {shiftLabel}
                </p>
              ) : null}
              <ul className="space-y-3">
                {slots.map((slot) => {
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
                        <p className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {slot.startTime}–{slot.endTime}
                          </span>
                          {slot.shiftName || slot.shiftCode ? (
                            <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                              {slot.shiftName ?? slot.shiftCode}
                            </span>
                          ) : null}
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
                          className={cn(
                            buttonVariants({ size: 'sm' }),
                            'shrink-0 rounded-xl text-xs',
                          )}
                        >
                          {isCurrent ? 'Take Attendance — Now' : 'Take Attendance'}
                        </Link>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}
