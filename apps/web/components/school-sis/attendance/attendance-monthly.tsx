'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchSchoolAcademicClasses, fetchSchoolAttendanceMonthly } from '@/services/school-sis';
import { AttendanceShell } from './attendance-ui';

function thisMonth() {
  return new Date().toISOString().slice(0, 7);
}

export function AttendanceMonthlyDesk() {
  const enabled = useAuthQueryEnabled();
  const [sectionId, setSectionId] = useState('');
  const [month, setMonth] = useState(thisMonth());
  const classes = useQuery({
    queryKey: ['school-academic-classes'],
    queryFn: fetchSchoolAcademicClasses,
    enabled,
  });
  const data = useQuery({
    queryKey: ['school-att-monthly', sectionId, month],
    queryFn: () => fetchSchoolAttendanceMonthly({ sectionId, month }),
    enabled: enabled && !!sectionId,
  });

  return (
    <AttendanceShell
      title="Monthly register"
      subtitle="Printable P / A / L / H / LV grid. Export PDF and Excel from Reports."
    >
      <div className="flex flex-wrap gap-2">
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="h-10 rounded-lg border px-3 text-sm"
        />
        <select
          value={sectionId}
          onChange={(e) => setSectionId(e.target.value)}
          className="h-10 rounded-lg border px-3 text-sm"
        >
          <option value="">Select section</option>
          {(classes.data?.sections ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.grade.name} {s.name}
            </option>
          ))}
        </select>
        <a
          className="inline-flex h-10 items-center rounded-lg bg-[#1e3a8a] px-3 text-sm text-white"
          href="/admin/school-sis/reports?module=attendance"
        >
          Open report engine
        </a>
      </div>
      {data.data ? (
        <div className="overflow-auto rounded-2xl border bg-white">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-2 py-2 text-left">Student</th>
                {(data.data.days as string[]).map((d) => (
                  <th key={d} className="px-1 py-2">
                    {d.slice(8)}
                  </th>
                ))}
                <th className="px-2 py-2">%</th>
              </tr>
            </thead>
            <tbody>
              {(
                data.data.students as Array<{
                  studentId: string;
                  fullName: string;
                  percent: number;
                  letters: Record<string, string>;
                }>
              ).map((s) => (
                <tr key={s.studentId} className="border-t">
                  <td className="whitespace-nowrap px-2 py-1 font-medium">{s.fullName}</td>
                  {(data.data.days as string[]).map((d) => (
                    <td key={d} className="px-1 py-1 text-center">
                      {s.letters[d] ?? ''}
                    </td>
                  ))}
                  <td className="px-2 py-1 tabular-nums">{s.percent}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-slate-500">Choose a section to load the register.</p>
      )}
    </AttendanceShell>
  );
}
