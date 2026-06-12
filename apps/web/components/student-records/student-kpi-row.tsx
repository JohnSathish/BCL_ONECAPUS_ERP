'use client';

import type { EnhancedStudentSummary } from '@/types/students';

type Props = {
  summary?: EnhancedStudentSummary;
};

export function StudentKpiRow({ summary }: Props) {
  const cards = [
    { label: 'Total students', value: summary?.total },
    { label: 'Active accounts', value: summary?.activeUsers },
    { label: 'With programme', value: summary?.withProgram },
    { label: 'Pending enrollment', value: summary?.pendingEnrollment },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-md border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">{c.label}</p>
          <p className="mt-1 text-2xl font-semibold">{c.value ?? '—'}</p>
        </div>
      ))}
      {summary?.bySemester ? (
        <div className="rounded-md border border-border bg-card p-3 sm:col-span-2 xl:col-span-4">
          <p className="text-xs font-medium text-muted-foreground">By semester</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(summary.bySemester)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([sem, count]) => (
                <span key={sem} className="rounded-full border border-border px-2 py-0.5 text-xs">
                  Sem {sem}: {count}
                </span>
              ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
