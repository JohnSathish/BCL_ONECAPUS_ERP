'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchSchoolSisTimetableDashboard } from '@/services/school-sis';
import { TimetableChrome, printedRange } from './tt-chrome';
import { cn } from '@/utils/cn';

export function SchoolSisTimetableDashboard() {
  const enabled = useAuthQueryEnabled();
  const q = useQuery({
    queryKey: ['school-sis-timetable-dashboard'],
    queryFn: fetchSchoolSisTimetableDashboard,
    enabled,
  });
  const data = q.data as any;
  const summary = data?.summary;
  const today = data?.today;
  const counts = [
    {
      label: 'Entries',
      value: summary?.validEntries ?? 0,
      href: '/admin/school-sis/timetable/weekly',
    },
    {
      label: 'Teacher conflicts',
      value: summary?.teacherConflicts?.length ?? 0,
      href: '/admin/school-sis/timetable/conflicts',
      warn: true,
    },
    {
      label: 'Empty periods',
      value: summary?.emptyPeriods?.length ?? 0,
      href: '/admin/school-sis/timetable/conflicts',
    },
    {
      label: 'Need confirmation',
      value: summary?.needsConfirmation?.length ?? 0,
      href: '/admin/school-sis/timetable/conflicts',
    },
  ];

  return (
    <TimetableChrome
      title="Timetable dashboard"
      hint="Monday–Friday bells match the printed 2026 school timetable. Assignments stay empty until office staff enter the official subject and teacher for each cell."
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {counts.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {card.label}
            </p>
            <p
              className={cn(
                'mt-1 text-3xl font-semibold',
                card.warn && card.value ? 'text-rose-600' : 'text-[#1a365d]',
              )}
            >
              {card.value}
            </p>
          </Link>
        ))}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#1a365d]">Today's Timetable</h2>
          <span className="text-sm text-slate-500">
            {today?.weekend ? 'Weekend — no periods' : 'Current day in Asia/Kolkata'}
          </span>
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {(today?.bells ?? []).map((row: any) => (
            <div
              key={row.bell.id}
              className={cn(
                'rounded-xl border px-3 py-2',
                row.bell.kind === 'BREAK' && 'border-sky-200 bg-sky-50',
                row.state === 'current' && 'border-[#1a365d] bg-[#1a365d] text-white',
                row.state === 'completed' && 'border-slate-200 bg-slate-50 text-slate-400',
                row.state === 'upcoming' && 'border-slate-200 bg-white',
              )}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
                {row.bell.label} · {printedRange(row.bell.startTime, row.bell.endTime)}
              </p>
              {row.bell.kind === 'BREAK' ? (
                <p className="font-semibold">{row.bell.label}</p>
              ) : (
                <>
                  <p className="font-semibold">
                    {row.slot?.subject?.name || row.slot?.printedSubject || 'Empty period'}
                  </p>
                  <p className="text-sm opacity-80">
                    {row.slot?.staff?.fullName || row.slot?.printedTeacher || '—'}
                    {row.slot?.section
                      ? ` · ${row.slot.section.grade.name} ${row.slot.section.name}`
                      : ''}
                  </p>
                </>
              )}
            </div>
          ))}
        </div>
      </section>
    </TimetableChrome>
  );
}
