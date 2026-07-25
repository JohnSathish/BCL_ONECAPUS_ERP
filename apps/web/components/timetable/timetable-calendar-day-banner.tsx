'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { applyTimetableCalendarDay, fetchTimetableCalendarDay } from '@/services/timetable';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function TimetableCalendarDayBanner({
  planId,
  shiftId,
  streamId,
}: {
  planId?: string;
  shiftId?: string;
  streamId?: string;
}) {
  const qc = useQueryClient();
  const date = todayIso();
  const dayQ = useQuery({
    queryKey: ['timetable', 'calendar-day', date, planId, shiftId, streamId],
    queryFn: () =>
      fetchTimetableCalendarDay({
        date,
        shiftId: shiftId || undefined,
        streamId: streamId || undefined,
      }),
  });

  const applyMut = useMutation({
    mutationFn: (action: 'CANCEL_DAY' | 'FORCE_RUN' | 'CLEAR_DAY_ACTIONS') => {
      if (!planId) throw new Error('Select a published plan first');
      return applyTimetableCalendarDay(planId, { date, action });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['timetable', 'calendar-day'] });
    },
  });

  const payload = dayQ.data;
  if (dayQ.isLoading) {
    return (
      <div className="rounded-xl border border-border/60 bg-card/80 px-4 py-3 text-sm text-muted-foreground">
        Checking Academic Calendar for today…
      </div>
    );
  }
  if (!payload) return null;

  const kind = payload.calendarDay.dayKind;
  const events = payload.calendarDay.events;
  const tone = payload.sessionsRun
    ? payload.calendarDay.createsAttendanceSession
      ? 'border-amber-300 bg-amber-50 text-amber-950'
      : 'border-emerald-200 bg-emerald-50 text-emerald-950'
    : 'border-rose-200 bg-rose-50 text-rose-950';

  return (
    <div className={cn('rounded-xl border px-4 py-3 shadow-sm', tone)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
            Today · Academic Calendar
          </p>
          <p className="text-sm font-semibold">
            {date} · {kind}
            {payload.sessionsRun
              ? ` · ${payload.sessions.length} period(s) run`
              : ` · periods suppressed (${payload.suppressedReason ?? kind})`}
          </p>
          {events.length ? (
            <p className="text-xs opacity-90">{events.map((e) => e.title).join(' · ')}</p>
          ) : (
            <p className="text-xs opacity-80">
              Working-day status comes from Academics → Academic Calendar.
            </p>
          )}
          {applyMut.isError ? (
            <p className="text-xs text-destructive">{apiErrorMessage(applyMut.error)}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/academics/academic-calendar">Open calendar</Link>
          </Button>
          {planId ? (
            <>
              {payload.sessionsRun ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={applyMut.isPending}
                  onClick={() => applyMut.mutate('CANCEL_DAY')}
                >
                  Cancel today
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={applyMut.isPending}
                  onClick={() => applyMut.mutate('FORCE_RUN')}
                >
                  Force run (holiday class)
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                disabled={applyMut.isPending}
                onClick={() => applyMut.mutate('CLEAR_DAY_ACTIONS')}
              >
                Clear override
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
