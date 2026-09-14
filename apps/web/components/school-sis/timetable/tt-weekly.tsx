'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TIMETABLE_DAYS } from '@/components/school-sis/school-sis-timetable-grid';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  fetchSchoolSisMasters,
  fetchSchoolSisMasterTimetable,
  type SchoolSisTimetableSlot,
} from '@/services/school-sis';
import { TimetableChrome, printedRange } from './tt-chrome';
import { cn } from '@/utils/cn';

export function SchoolSisWeeklyTimetable() {
  const enabled = useAuthQueryEnabled();
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const masters = useQuery({
    queryKey: ['school-sis-masters'],
    queryFn: fetchSchoolSisMasters,
    enabled,
  });
  const grid = useQuery({
    queryKey: ['school-sis-timetable-master', dayOfWeek],
    queryFn: () => fetchSchoolSisMasterTimetable({ dayOfWeek }),
    enabled,
  });
  const sections = masters.data?.sections ?? [];
  const bells = grid.data?.bells ?? [];
  const slotMap = useMemo(() => {
    const map = new Map<string, SchoolSisTimetableSlot>();
    for (const slot of grid.data?.slots ?? []) {
      map.set(`${slot.section?.id ?? slot.sectionId}:${slot.bellId}`, slot);
    }
    return map;
  }, [grid.data?.slots]);

  return (
    <TimetableChrome
      title="Complete school timetable"
      hint="Class names on the left, periods across the top — the printed 2026 sheet, as a live grid."
    >
      <div className="flex flex-wrap gap-2">
        {TIMETABLE_DAYS.filter((d) => d.id <= 5).map((day) => (
          <button
            key={day.id}
            type="button"
            onClick={() => setDayOfWeek(day.id)}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-semibold',
              dayOfWeek === day.id ? 'bg-[#1a365d] text-white' : 'border border-slate-200 bg-white',
            )}
          >
            {day.full}
          </button>
        ))}
      </div>
      <div className="hidden overflow-x-auto rounded-2xl border border-[#1a365d] bg-white lg:block">
        <table className="min-w-[1100px] w-full border-collapse text-left text-[11px]">
          <thead>
            <tr className="bg-[#1a365d] text-white">
              <th className="px-3 py-2">Class</th>
              {bells.map((bell) => (
                <th
                  key={bell.id}
                  className={cn('px-2 py-2', bell.kind === 'BREAK' && 'bg-[#2b4c7e]')}
                >
                  <span className="block font-semibold uppercase">{bell.label}</span>
                  <span className="font-normal opacity-80">
                    {printedRange(bell.startTime, bell.endTime)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sections.map((section) => (
              <tr key={section.id} className="border-t border-slate-200">
                <th className="whitespace-nowrap bg-[#e8eef6] px-3 py-2 text-left text-[#1a365d]">
                  {section.grade.name}
                  {section.name !== 'A' ? ` ${section.name}` : ''}
                </th>
                {bells.map((bell) => {
                  if (bell.kind === 'BREAK') {
                    return (
                      <td
                        key={bell.id}
                        className="bg-sky-50 px-2 py-2 text-center font-semibold text-sky-800"
                      >
                        {bell.label}
                      </td>
                    );
                  }
                  const slot = slotMap.get(`${section.id}:${bell.id}`);
                  return (
                    <td key={bell.id} className="px-2 py-2 align-top">
                      {slot ? (
                        <>
                          <p className="font-semibold uppercase text-[#1a365d]">
                            {slot.subject?.name || slot.printedSubject || '—'}
                          </p>
                          <p className="text-slate-500">
                            {slot.staff?.fullName || slot.printedTeacher || ''}
                          </p>
                          {slot.needsConfirmation ? (
                            <p className="text-[10px] font-semibold text-amber-700">Confirm</p>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 lg:hidden">
        {sections.map((section) => (
          <article key={section.id} className="rounded-2xl border bg-white p-3">
            <h3 className="font-semibold text-[#1a365d]">
              {section.grade.name} {section.name}
            </h3>
            <div className="mt-2 space-y-2">
              {bells.map((bell) => {
                const slot = slotMap.get(`${section.id}:${bell.id}`);
                return (
                  <div key={bell.id} className="rounded-xl bg-slate-50 px-3 py-2">
                    <p className="text-[11px] uppercase text-slate-400">
                      {bell.label} · {printedRange(bell.startTime, bell.endTime)}
                    </p>
                    <p className="font-medium">
                      {bell.kind === 'BREAK'
                        ? bell.label
                        : slot?.subject?.name || slot?.printedSubject || 'Empty'}
                    </p>
                    {slot?.staff || slot?.printedTeacher ? (
                      <p className="text-sm text-slate-500">
                        {slot.staff?.fullName || slot.printedTeacher}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </article>
        ))}
      </div>
    </TimetableChrome>
  );
}
