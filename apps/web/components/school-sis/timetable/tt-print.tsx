'use client';

import { useState } from 'react';
import { TIMETABLE_DAYS } from '@/components/school-sis/school-sis-timetable-grid';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import {
  downloadSchoolSisTimetableExcel,
  downloadSchoolSisTimetablePdf,
  fetchSchoolSisMasters,
} from '@/services/school-sis';
import { api } from '@/services/api';
import { TimetableChrome } from './tt-chrome';

export function SchoolSisTimetablePrint() {
  const enabled = useAuthQueryEnabled();
  const [dayOfWeek, setDayOfWeek] = useState('');
  const [sectionId, setSectionId] = useState('');
  const masters = useQuery({
    queryKey: ['school-sis-masters'],
    queryFn: fetchSchoolSisMasters,
    enabled,
  });
  const params = {
    dayOfWeek: dayOfWeek ? Number(dayOfWeek) : undefined,
    sectionId: sectionId || undefined,
  };
  return (
    <TimetableChrome
      title="Print / export"
      hint="A4 landscape sheets in the school’s printed layout: crest, TIME TABLE heading, class rows, period columns, break bands."
    >
      <div className="flex flex-wrap gap-3 rounded-2xl border bg-white p-4">
        <select
          className="h-10 rounded-lg border px-3 text-sm"
          value={dayOfWeek}
          onChange={(e) => setDayOfWeek(e.target.value)}
        >
          <option value="">All weekdays</option>
          {TIMETABLE_DAYS.filter((d) => d.id <= 5).map((d) => (
            <option key={d.id} value={d.id}>
              {d.full}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-lg border px-3 text-sm"
          value={sectionId}
          onChange={(e) => setSectionId(e.target.value)}
        >
          <option value="">All classes</option>
          {(masters.data?.sections ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.grade.name} {s.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="rounded-xl bg-[#1a365d] px-4 py-2 text-sm text-white"
          onClick={() => void downloadSchoolSisTimetablePdf(params)}
        >
          Download PDF
        </button>
        <button
          type="button"
          className="rounded-xl border px-4 py-2 text-sm"
          onClick={() => void downloadSchoolSisTimetableExcel(params.dayOfWeek)}
        >
          Export Excel
        </button>
        <button
          type="button"
          className="rounded-xl border px-4 py-2 text-sm"
          onClick={async () => {
            const { data } = await api.get('/v1/school-sis/timetable/print', {
              params,
              responseType: 'text',
            });
            const w = window.open('', '_blank');
            if (w) {
              w.document.write(String(data));
              w.document.close();
              w.focus();
            }
          }}
        >
          Open print view
        </button>
      </div>
    </TimetableChrome>
  );
}
