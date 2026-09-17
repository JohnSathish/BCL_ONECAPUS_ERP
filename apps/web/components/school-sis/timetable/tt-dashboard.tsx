'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchSchoolSisTimetableDashboard } from '@/services/school-sis';
import { TimetableChrome, printedRange } from './tt-chrome';
import { cn } from '@/utils/cn';

type Bell = {
  id: string;
  kind: string;
  label: string;
  startTime: string;
  endTime: string;
  periodNumber?: number | null;
  code?: string;
};

type TodayRow = {
  bell: Bell;
  state: string;
  slot?: {
    subject?: { name: string } | null;
    printedSubject?: string | null;
    staff?: { fullName: string } | null;
    printedTeacher?: string | null;
    section?: { name: string; grade: { name: string } } | null;
  } | null;
};

type DashboardPayload = {
  academicYear?: { name?: string };
  summary?: {
    validEntries?: number;
    teacherConflicts?: unknown[];
    emptyPeriods?: unknown[];
    needsConfirmation?: unknown[];
  };
  today?: {
    dayOfWeek?: number;
    weekend?: boolean;
    bells?: TodayRow[];
  };
};

function istLongDate() {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
}

function periodIndex(bell: Bell, fallback: number) {
  if (bell.periodNumber) return bell.periodNumber;
  const n = Number(String(bell.code ?? '').replace(/\D/g, ''));
  return n || fallback;
}

function isLunch(label: string) {
  return /lunch/i.test(label);
}

export function SchoolSisTimetableDashboard() {
  const enabled = useAuthQueryEnabled();
  const q = useQuery({
    queryKey: ['school-sis-timetable-dashboard'],
    queryFn: fetchSchoolSisTimetableDashboard,
    enabled,
  });
  const data = (q.data ?? {}) as DashboardPayload;
  const summary = data.summary;
  const today = data.today;
  const entries = summary?.validEntries ?? 0;
  const conflicts = summary?.teacherConflicts?.length ?? 0;
  const empty = summary?.emptyPeriods?.length ?? 0;
  const confirm = summary?.needsConfirmation?.length ?? 0;
  const bells = today?.bells ?? [];

  const kpis = [
    {
      label: 'Total Entries',
      sub: 'Timetable slots filled',
      value: entries,
      href: '/admin/school-sis/timetable/weekly',
      wrap: 'bg-blue-50/90',
      icon: 'bg-blue-100 text-blue-700',
      path: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z',
    },
    {
      label: 'Teacher Conflicts',
      sub: 'Overlapping assignments',
      value: conflicts,
      href: '/admin/school-sis/timetable/conflicts',
      wrap: 'bg-rose-50/90',
      icon: 'bg-rose-100 text-rose-700',
      path: 'M12 9v4M12 17h.01M10.3 4.3 1.8 19a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z',
    },
    {
      label: 'Empty Periods',
      sub: 'Periods without assignment',
      value: empty,
      href: '/admin/school-sis/timetable/conflicts',
      wrap: 'bg-amber-50/90',
      icon: 'bg-amber-100 text-amber-700',
      path: 'M12 8v4l3 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    },
    {
      label: 'Need Confirmation',
      sub: 'Changes pending approval',
      value: confirm,
      href: '/admin/school-sis/timetable/conflicts',
      wrap: 'bg-emerald-50/90',
      icon: 'bg-emerald-100 text-emerald-700',
      path: 'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3',
    },
  ];

  return (
    <TimetableChrome
      title="Timetable Dashboard"
      hint="Monday–Friday bells match the printed 2026 school timetable. Assignments stay empty until office staff enter the official subject and teacher for each cell."
    >
      {q.isLoading ? <p className="text-sm text-slate-500">Loading timetable…</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className={cn(
              'flex items-center justify-between gap-3 rounded-2xl border border-white/80 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md',
              card.wrap,
            )}
          >
            <div className="flex items-start gap-3">
              <span
                className={cn('flex h-10 w-10 items-center justify-center rounded-xl', card.icon)}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d={card.path} />
                </svg>
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {card.label}
                </p>
                <p className="text-2xl font-semibold text-slate-900">{card.value}</p>
                <p className="text-[11px] text-slate-500">{card.sub}</p>
              </div>
            </div>
            <span className="text-slate-300">›</span>
          </Link>
        ))}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 text-slate-400">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
            </span>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Today&apos;s Timetable</h2>
              <p className="text-sm text-slate-500">{istLongDate()}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-xs text-slate-500">
              Current day in Asia/Kolkata
            </span>
            <Link
              href="/admin/school-sis/timetable/weekly"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              View Weekly
            </Link>
          </div>
        </div>

        {today?.weekend ? (
          <p className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            Weekend — no periods on the printed Monday–Friday timetable.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {bells.map((row, i) => {
              const breakBell = row.bell.kind === 'BREAK';
              const lunch = isLunch(row.bell.label);
              const subject =
                row.slot?.subject?.name ||
                row.slot?.printedSubject ||
                (breakBell ? row.bell.label : 'Empty period');
              const teacher = row.slot?.staff?.fullName || row.slot?.printedTeacher;
              const assigned = Boolean(
                row.slot?.subject || row.slot?.staff || row.slot?.printedSubject,
              );
              return (
                <div
                  key={row.bell.id}
                  className={cn(
                    'rounded-2xl border p-4',
                    breakBell && lunch && 'border-amber-100 bg-amber-50/80',
                    breakBell && !lunch && 'border-emerald-100 bg-emerald-50/80',
                    !breakBell && 'border-slate-200 bg-white',
                    row.state === 'current' && 'ring-2 ring-[#1e3a8a]/30',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                          breakBell && lunch && 'bg-amber-100 text-amber-800',
                          breakBell && !lunch && 'bg-emerald-100 text-emerald-800',
                          !breakBell && 'bg-blue-50 text-blue-800',
                        )}
                      >
                        {breakBell ? (
                          <svg
                            width="15"
                            height="15"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                          >
                            {lunch ? (
                              <>
                                <path d="M4 3v8M8 3v8M4 11h4M6 11v10M16 8h.01M14 4v7a4 4 0 0 0 8 0V4" />
                              </>
                            ) : (
                              <path d="M17 8h1a4 4 0 0 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z" />
                            )}
                          </svg>
                        ) : (
                          periodIndex(row.bell, i + 1)
                        )}
                      </span>
                      <div>
                        <p className="font-semibold text-slate-900">{row.bell.label}</p>
                        <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-slate-500">
                          {printedRange(row.bell.startTime, row.bell.endTime)}
                        </p>
                      </div>
                    </div>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                        breakBell && 'bg-white/80 text-slate-600',
                        !breakBell && assigned && 'bg-emerald-50 text-emerald-800',
                        !breakBell && !assigned && 'bg-slate-100 text-slate-500',
                      )}
                    >
                      {breakBell ? 'Break' : assigned ? 'Assigned' : 'Unassigned'}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                    {!breakBell ? (
                      <span className="text-slate-400">
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                        >
                          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                        </svg>
                      </span>
                    ) : null}
                    <span>
                      {subject}
                      {teacher ? (
                        <span className="block text-xs text-slate-500">{teacher}</span>
                      ) : null}
                      {row.slot?.section ? (
                        <span className="block text-xs text-slate-400">
                          {row.slot.section.grade.name} {row.slot.section.name}
                        </span>
                      ) : null}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {entries === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/80 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-indigo-900">No assignments yet</p>
            <p className="text-xs text-indigo-800/80">
              The timetable will be populated once the office staff enter the subjects and teachers
              for each period. Use the weekly or class-wise view to manage assignments.
            </p>
          </div>
          <Link
            href="/admin/school-sis/timetable/weekly"
            className="inline-flex h-10 shrink-0 items-center rounded-xl bg-white px-4 text-sm font-semibold text-[#1e3a8a] shadow-sm"
          >
            Manage Timetable
          </Link>
        </div>
      ) : null}
    </TimetableChrome>
  );
}
