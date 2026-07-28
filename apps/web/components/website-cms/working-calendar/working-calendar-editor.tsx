'use client';

import { useMemo, useState } from 'react';
import {
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CircleDot,
} from 'lucide-react';
import type { AcademicPlannerDay } from '@/types/website-cms';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';
import { PlannerStatusBadge, resolvePlannerDayStatus } from './planner-status';

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

const PLANNER_STATUS_OPTIONS = [
  '',
  'Class',
  'Holiday',
  'National Holiday',
  'State Holiday',
  'College Holiday',
  'Restricted Holiday',
  'Holiday Class',
  'Compensatory',
  'Makeup Class',
  'Break',
  'Teaching Break',
  'Exam',
  'Internal Assessment',
  'Orientation',
  'Bridge Course',
  'Result',
  'Admission',
  'Institutional Event',
  'Staff Event',
  'Working',
  'Non-working',
  'Weekend',
] as const;

type MonthChoice = { key: string; label: string; year: number; month: number };

type Props = {
  monthChoices: MonthChoice[];
  monthKey: string;
  monthTitle: string;
  draftDays: AcademicPlannerDay[];
  saving?: boolean;
  onSelectMonth: (key: string) => void;
  onPatchDay: (index: number, patch: Partial<AcademicPlannerDay>) => void;
  onSave: () => void;
};

function statusOptionsForDay(current: string) {
  const trimmed = current.trim();
  if (trimmed && !(PLANNER_STATUS_OPTIONS as readonly string[]).includes(trimmed)) {
    return [...PLANNER_STATUS_OPTIONS, trimmed];
  }
  return [...PLANNER_STATUS_OPTIONS];
}

export function WorkingCalendarEditor({
  monthChoices,
  monthKey,
  monthTitle,
  draftDays,
  saving,
  onSelectMonth,
  onPatchDay,
  onSave,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedIndex = draftDays.findIndex((day) => day.id === selectedId);
  const selected = selectedIndex >= 0 ? draftDays[selectedIndex] : null;

  const activeChoice = monthChoices.find((item) => item.key === monthKey);
  const year = activeChoice?.year ?? Number(monthKey.slice(0, 4));
  const month = activeChoice?.month ?? Number(monthKey.slice(5, 7));

  const workingDays = draftDays.filter((day) => day.isWorkingDay).length;
  const events = useMemo(
    () =>
      draftDays.flatMap((day) =>
        day.description
          .split(/\n+/)
          .map((line) => line.trim())
          .filter(Boolean)
          .map((title) => ({ date: day.date, dayOfMonth: day.dayOfMonth, title })),
      ),
    [draftDays],
  );

  const summary = useMemo(() => {
    let weekends = 0;
    let holidays = 0;
    let optional = 0;
    for (const day of draftDays) {
      const visual = resolvePlannerDayStatus(day);
      if (visual.status === 'weekend') weekends += 1;
      if (visual.status === 'holiday') holidays += 1;
      if (visual.status === 'optional') optional += 1;
    }
    return { weekends, holidays, optional };
  }, [draftDays]);

  const cells = useMemo(() => {
    const byDate = new Map(draftDays.map((day) => [day.date, day]));
    const first = new Date(Date.UTC(year, month - 1, 1));
    const startPad = first.getUTCDay();
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const total = Math.ceil((startPad + daysInMonth) / 7) * 7;
    const result: Array<{ key: string; day: AcademicPlannerDay | null; outside: boolean }> = [];
    for (let i = 0; i < total; i += 1) {
      const dayNumber = i - startPad + 1;
      if (dayNumber < 1 || dayNumber > daysInMonth) {
        result.push({ key: `pad-${i}`, day: null, outside: true });
        continue;
      }
      const date = `${year}-${String(month).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
      result.push({ key: date, day: byDate.get(date) ?? null, outside: false });
    }
    return result;
  }, [draftDays, month, year]);

  const activeIndex = monthChoices.findIndex((item) => item.key === monthKey);
  const prev = activeIndex > 0 ? monthChoices[activeIndex - 1] : null;
  const next =
    activeIndex >= 0 && activeIndex < monthChoices.length - 1
      ? monthChoices[activeIndex + 1]
      : null;

  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-2" aria-label="Planner months">
        {monthChoices.map((item) => {
          const active = item.key === monthKey;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelectMonth(item.key)}
              className={cn(
                'rounded-full border px-3.5 py-2 text-xs font-semibold tracking-wide transition-all duration-200',
                active
                  ? 'border-[#1E3A8A] bg-[#1E3A8A] text-white shadow-md'
                  : 'border-border bg-card text-foreground hover:border-primary/40 hover:bg-primary/5',
              )}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!prev}
            onClick={() => prev && onSelectMonth(prev.key)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card disabled:opacity-40"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2 px-1">
            <CalendarDays className="h-5 w-5 text-[#1E3A8A]" aria-hidden />
            <h2 className="text-xl font-semibold tracking-tight">{monthTitle}</h2>
          </div>
          <button
            type="button"
            disabled={!next}
            onClick={() => next && onSelectMonth(next.key)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card disabled:opacity-40"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-2xl bg-[#1E3A8A] px-4 py-3 text-white shadow-md">
            <CalendarDays className="h-4 w-4 opacity-90" aria-hidden />
            <span className="text-sm font-medium">Working Days</span>
            <strong className="text-lg font-bold leading-none">{workingDays}</strong>
          </div>
          <Button disabled={saving || !draftDays.length} onClick={onSave}>
            Save month
          </Button>
        </div>
      </div>

      {!draftDays.length ? (
        <p className="rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground">
          No day rows yet. Click <strong>Generate month</strong> to create the handbook table for
          this month.
        </p>
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="hidden grid-cols-7 bg-[#1E3A8A] lg:grid">
              {WEEKDAYS.map((label) => (
                <div
                  key={label}
                  className="px-2 py-3 text-center text-[11px] font-semibold tracking-[0.14em] text-white"
                >
                  {label}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-2 bg-slate-50 p-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
              {cells.map((cell) => {
                if (cell.outside || !cell.day) {
                  return (
                    <div
                      key={cell.key}
                      className="hidden min-h-[96px] rounded-2xl border border-dashed border-border/60 bg-muted/20 lg:block"
                      aria-hidden
                    />
                  );
                }
                const visual = resolvePlannerDayStatus(cell.day);
                const activeDay = cell.day.id === selectedId;
                const preview =
                  cell.day.description
                    .split(/\n+/)
                    .map((s) => s.trim())
                    .filter(Boolean)[0] ??
                  (cell.day.statusLabel || '');
                return (
                  <button
                    key={cell.key}
                    type="button"
                    onClick={() => setSelectedId(cell.day!.id)}
                    className={cn(
                      'flex min-h-[96px] flex-col rounded-2xl border bg-white p-3 text-left shadow-sm transition duration-200 hover:scale-[1.02] hover:shadow-md',
                      activeDay ? 'border-primary ring-2 ring-primary/30' : 'border-border',
                    )}
                    aria-label={`Edit ${cell.day.date}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-base font-semibold">{cell.day.dayOfMonth}</span>
                      <span className="text-[10px] font-medium uppercase text-muted-foreground">
                        {cell.day.dayOfWeek}
                      </span>
                    </div>
                    <div className="mt-auto space-y-1.5 pt-3">
                      <PlannerStatusBadge status={visual.status} label={visual.label} />
                      {preview ? (
                        <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                          {preview}
                        </p>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {selected && selectedIndex >= 0 ? (
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">
                  Edit {selected.date} · {selected.dayOfWeek}
                </h3>
                <Button size="sm" variant="ghost" onClick={() => setSelectedId(null)}>
                  Close
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-[180px_1fr_120px]">
                <label className="space-y-1 text-xs font-medium text-muted-foreground">
                  Status
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    value={selected.statusLabel}
                    onChange={(event) => {
                      const statusLabel = event.target.value;
                      const isHolidayLike =
                        /holiday|break|weekend|non-working/i.test(statusLabel) &&
                        !/holiday class|compensatory|makeup/i.test(statusLabel);
                      onPatchDay(selectedIndex, {
                        statusLabel,
                        ...(statusLabel === ''
                          ? { isWorkingDay: false, isHighlighted: true }
                          : isHolidayLike
                            ? { isWorkingDay: false, isHighlighted: true }
                            : {
                                isWorkingDay: true,
                                isHighlighted: selected.dayOfWeek === 'SUN',
                              }),
                      });
                    }}
                    aria-label={`Status for ${selected.date}`}
                  >
                    {statusOptionsForDay(selected.statusLabel).map((option) => (
                      <option key={option || '__empty'} value={option}>
                        {option || (selected.dayOfWeek === 'SUN' ? '— (Sunday)' : '—')}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-xs font-medium text-muted-foreground">
                  Events / notes
                  <textarea
                    value={selected.description}
                    onChange={(event) =>
                      onPatchDay(selectedIndex, { description: event.target.value })
                    }
                    rows={3}
                    className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                    placeholder="Seminars, meetings, observances…"
                  />
                </label>
                <label className="flex items-center gap-2 self-end rounded-md border border-border bg-background px-3 py-2 text-xs">
                  <input
                    type="checkbox"
                    checked={selected.isWorkingDay}
                    onChange={(event) =>
                      onPatchDay(selectedIndex, {
                        isWorkingDay: event.target.checked,
                        isHighlighted: !event.target.checked || selected.dayOfWeek === 'SUN',
                      })
                    }
                  />
                  Count as working day
                </label>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Click a date card to edit status, events, and working-day count.
            </p>
          )}

          <div className="grid gap-4 lg:grid-cols-[260px_260px_1fr]">
            <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <CircleDot className="h-4 w-4 text-[#1E3A8A]" />
                <h3 className="text-sm font-semibold">Legend</h3>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#22C55E]" /> Working Day
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#2563EB]" /> Weekend
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#F59E0B]" /> Working on Saturday
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#EF4444]" /> Holiday
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-violet-500" /> Optional Holiday
                </li>
              </ul>
            </section>
            <section className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-4 shadow-sm">
              <div className="mb-2 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-[#1E3A8A]" />
                <h3 className="text-sm font-semibold">Monthly Summary</h3>
              </div>
              <p className="mb-3 text-3xl font-bold text-[#1E3A8A]">{workingDays}</p>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li>Weekends · {summary.weekends}</li>
                <li>Public Holidays · {summary.holidays}</li>
                <li>Optional Holidays · {summary.optional}</li>
              </ul>
            </section>
            <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-[#2563EB]" />
                <h3 className="text-sm font-semibold">Events / Notes</h3>
              </div>
              {events.length ? (
                <ul className="max-h-48 space-y-2 overflow-auto">
                  {events.map((event) => (
                    <li
                      key={`${event.date}-${event.title}`}
                      className="rounded-xl border border-border bg-muted/20 px-3 py-2 text-sm"
                    >
                      <strong className="mr-2 text-[#1E3A8A]">{event.dayOfMonth}</strong>
                      {event.title}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Add notes or important events for this month.
                </p>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
