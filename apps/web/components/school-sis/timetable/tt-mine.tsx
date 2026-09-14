'use client';

import { useQuery } from '@tanstack/react-query';
import { SchoolSisTimetableGrid } from '@/components/school-sis/school-sis-timetable-grid';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchMySchoolSisTimetable, fetchSchoolSisMasters } from '@/services/school-sis';
import { TimetableChrome, printedRange } from './tt-chrome';
import { cn } from '@/utils/cn';

export function SchoolSisMyTimetable() {
  const enabled = useAuthQueryEnabled();
  const mine = useQuery({
    queryKey: ['school-sis-timetable-mine'],
    queryFn: fetchMySchoolSisTimetable,
    enabled,
  });
  const masters = useQuery({
    queryKey: ['school-sis-masters'],
    queryFn: fetchSchoolSisMasters,
    enabled,
  });
  const grid = mine.data;
  const today = (mine.data as any)?.today;
  if (mine.isError) {
    return (
      <TimetableChrome
        title="My Timetable"
        hint="Shown when this login is linked to a teacher email on the staff record."
      >
        <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          No teacher record matches this account yet. Open Teacher-wise timetable to look up a
          colleague by name.
        </p>
      </TimetableChrome>
    );
  }
  return (
    <TimetableChrome
      title="My Timetable"
      hint="Today’s classes, then the full week for the signed-in teacher."
    >
      <section className="rounded-2xl border bg-white p-4">
        <h2 className="mb-3 font-semibold text-[#1a365d]">Today’s classes</h2>
        <div className="space-y-2">
          {(today?.bells ?? []).map((row: any) => (
            <div
              key={row.bell.id}
              className={cn(
                'flex justify-between rounded-xl px-3 py-2 text-sm',
                row.state === 'current' && 'bg-[#1a365d] text-white',
                row.state === 'completed' && 'bg-slate-50 text-slate-400',
                row.state !== 'current' && row.state !== 'completed' && 'bg-slate-50',
              )}
            >
              <span>
                {printedRange(row.bell.startTime, row.bell.endTime)} · {row.bell.label}
              </span>
              <span>
                {row.bell.kind === 'BREAK'
                  ? row.bell.label
                  : `${row.slot?.subject?.name ?? 'Free'} · ${row.slot?.section?.grade?.name ?? ''} ${row.slot?.section?.name ?? ''}`}
              </span>
            </div>
          ))}
        </div>
      </section>
      {grid?.plan ? (
        <SchoolSisTimetableGrid
          grid={grid}
          subjects={masters.data?.subjects ?? []}
          staff={[]}
          queryKey={['school-sis-timetable-mine']}
          mode="teacher"
          printTitle={grid.staff?.fullName}
        />
      ) : null}
    </TimetableChrome>
  );
}
