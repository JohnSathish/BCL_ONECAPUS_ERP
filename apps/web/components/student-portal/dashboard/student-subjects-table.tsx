'use client';

import Link from 'next/link';
import type { StudentAcademicChip } from '@/types/student-portal';

const TYPE_COLORS: Record<string, string> = {
  MAJOR: 'bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200',
  MINOR: 'bg-violet-50 text-violet-800 dark:bg-violet-950/40 dark:text-violet-200',
  MDC: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
  AEC: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
  SEC: 'bg-indigo-50 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200',
  VAC: 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200',
  VTC: 'bg-orange-50 text-orange-800 dark:bg-orange-950/40 dark:text-orange-200',
};

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

export function StudentSubjectsTable({
  chips,
  semesterSequence,
  loading,
}: {
  chips?: StudentAcademicChip[];
  semesterSequence?: number | null;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="h-5 w-40 rounded bg-muted" />
        <div className="mt-4 h-32 rounded bg-muted" />
      </div>
    );
  }

  const rows = chips ?? [];
  const legend = Object.entries(
    rows.reduce<Record<string, number>>((acc, row) => {
      const key = row.category || 'OTHER';
      acc[key] = (acc[key] ?? 0) + Number(row.credits ?? 0);
      return acc;
    }, {}),
  );
  const semLabel =
    semesterSequence != null ? (ROMAN[semesterSequence] ?? String(semesterSequence)) : null;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            My Current Subjects
            {semLabel ? (
              <span className="ml-1 font-normal text-slate-500">(Semester {semLabel})</span>
            ) : null}
          </h3>
          <p className="text-xs text-slate-500">Registered courses this term</p>
        </div>
        <Link
          href="/student/registration"
          className="text-xs font-medium text-[#1e4d8c] hover:underline dark:text-sky-300"
        >
          View all
        </Link>
      </div>
      {!rows.length ? (
        <p className="px-4 py-8 text-center text-sm text-slate-500">
          No subjects loaded yet. Complete registration to see your courses.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wide text-slate-400 dark:border-slate-800">
                <th className="px-4 py-2 font-semibold">Code</th>
                <th className="px-4 py-2 font-semibold">Title</th>
                <th className="px-4 py-2 font-semibold">Type</th>
                <th className="px-4 py-2 font-semibold">Credits</th>
                <th className="px-4 py-2 font-semibold">Faculty</th>
                <th className="px-4 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 10).map((row, i) => (
                <tr
                  key={`${row.courseCode ?? row.label}-${row.courseTitle}-${i}`}
                  className="border-b border-slate-50 last:border-0 dark:border-slate-800/60"
                >
                  <td className="px-4 py-2.5 font-mono text-xs font-medium text-slate-700 dark:text-slate-200">
                    {row.courseCode || row.label || '—'}
                  </td>
                  <td className="px-4 py-2.5 text-slate-800 dark:text-slate-100">
                    {row.courseTitle}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        TYPE_COLORS[row.category] ??
                        'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {row.category || row.label || 'Course'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-slate-700 dark:text-slate-200">
                    {row.credits != null && row.credits > 0 ? row.credits : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                    {row.facultyName || '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                      In Progress
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {legend.length ? (
        <div className="flex flex-wrap gap-3 border-t border-slate-100 px-4 py-2.5 text-[11px] text-slate-500 dark:border-slate-800">
          {legend.map(([cat, credits]) => (
            <span key={cat}>
              <span className="font-semibold text-slate-700 dark:text-slate-200">{cat}</span>
              {': '}
              {credits} cr
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
