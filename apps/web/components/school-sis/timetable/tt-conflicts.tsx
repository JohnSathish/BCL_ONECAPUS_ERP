'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { validateSchoolSisTimetable } from '@/services/school-sis';
import { TimetableChrome } from './tt-chrome';

function Block({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="font-semibold text-[#1a365d]">
        {title} <span className="text-slate-400">({items.length})</span>
      </h2>
      {items.length ? (
        <ul className="mt-2 space-y-1 text-sm text-slate-700">
          {items.map((item) => (
            <li key={item}>⚠️ {item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-emerald-700">None</p>
      )}
    </section>
  );
}

export function SchoolSisTimetableConflicts() {
  const enabled = useAuthQueryEnabled();
  const q = useQuery({
    queryKey: ['school-sis-timetable-validate'],
    queryFn: validateSchoolSisTimetable,
    enabled,
  });
  const data = q.data;
  return (
    <TimetableChrome
      title="Timetable conflicts"
      hint="Teacher double-booking is blocked on save. Empty periods and unclear printed cells stay visible here until office staff confirm them."
    >
      {q.isLoading ? <p className="text-sm text-slate-500">Checking…</p> : null}
      {data ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <Block title="Teacher clashes" items={data.teacherConflicts} />
          <Block title="Room clashes" items={data.roomConflicts} />
          <Block title="Missing teachers" items={data.missingTeachers} />
          <Block title="Missing subjects" items={data.missingSubjects} />
          <Block title="Empty periods" items={(data.emptyPeriods ?? []).slice(0, 80)} />
          <Block title="Need confirmation" items={data.needsConfirmation ?? []} />
        </div>
      ) : null}
    </TimetableChrome>
  );
}
