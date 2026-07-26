'use client';

import Link from 'next/link';
import { Clock, MapPin, User } from 'lucide-react';
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
      <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="h-5 w-40 rounded bg-muted" />
        <div className="mt-4 space-y-3">
          <div className="h-14 rounded-xl bg-muted" />
          <div className="h-14 rounded-xl bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">
            Today&apos;s Timetable
          </h3>
          <p className="text-xs text-slate-500">In progress &amp; upcoming periods</p>
        </div>
        <Link
          href="/student/timetable"
          className="text-xs font-medium text-[#1e4d8c] hover:underline dark:text-sky-300"
        >
          Full week
        </Link>
      </div>

      {!schedule?.length ? (
        <p className="mt-6 rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700">
          No classes scheduled for today.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {schedule.map((slot) => {
            const title = slot.course?.title ?? slot.course?.code ?? 'Class';
            const room = slot.classroom?.code || slot.classroom?.name;
            const faculty = slot.staffProfile?.fullName || slot.staffProfile?.shortCode;
            const status = slot.isCurrent ? 'In Progress' : slot.isPast ? 'Completed' : 'Upcoming';

            return (
              <li
                key={slot.id}
                className={cn(
                  'relative flex gap-3 rounded-xl border border-slate-100 py-3 pl-4 pr-3 dark:border-slate-800',
                  slot.isCurrent && 'border-[#1e4d8c]/30 bg-sky-50/60 dark:bg-sky-950/20',
                  slot.isPast && 'opacity-60',
                )}
              >
                <div className="w-[4.5rem] shrink-0">
                  <p className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                    <Clock className="h-3 w-3" />
                    {slot.startTime}
                  </p>
                  {slot.endTime ? (
                    <p className="text-[10px] text-slate-400">{slot.endTime}</p>
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900 dark:text-white">{title}</p>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                    {room ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {room}
                      </span>
                    ) : null}
                    {faculty ? (
                      <span className="inline-flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {faculty}
                      </span>
                    ) : null}
                    {slot.fyugpCategory ? <span>{slot.fyugpCategory}</span> : null}
                  </div>
                </div>
                <span
                  className={cn(
                    'shrink-0 self-center rounded-full px-2 py-0.5 text-[10px] font-semibold',
                    slot.isCurrent
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                      : slot.isPast
                        ? 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                        : 'bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200',
                  )}
                >
                  {status}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
