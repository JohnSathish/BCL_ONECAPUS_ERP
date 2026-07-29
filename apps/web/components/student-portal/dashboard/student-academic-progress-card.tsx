'use client';

import Link from 'next/link';
import type { StudentDashboardView } from '@/types/student-portal';

export function StudentAcademicProgressCard({
  data,
  loading,
}: {
  data?: StudentDashboardView;
  loading?: boolean;
}) {
  if (loading || !data) {
    return (
      <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="h-5 w-36 rounded bg-muted" />
        <div className="mt-4 h-28 rounded-full bg-muted" />
      </div>
    );
  }

  const creditsPct = data.credits?.percent ?? null;
  const subjectsPct = Math.min(100, (data.academicChips?.length ?? 0) * 12);
  const ringPct =
    creditsPct != null && creditsPct > 0 ? creditsPct : (data.profile.profileCompletion ?? 0);
  const r = 42;
  const circ = 2 * Math.PI * r;
  const offset = circ - (ringPct / 100) * circ;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Academic Progress</h3>
        <Link
          href="/student/results"
          className="text-xs font-medium text-[#1e4d8c] hover:underline dark:text-sky-300"
        >
          Details
        </Link>
      </div>
      <div className="mt-4 flex items-center gap-4">
        <div className="relative h-28 w-28 shrink-0">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-slate-100 dark:text-slate-800"
            />
            <circle
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke="#1e4d8c"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-slate-900 dark:text-white">{ringPct}%</span>
            <span className="text-[10px] text-slate-400">Complete</span>
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <Bar
            label="Credits"
            value={creditsPct ?? 0}
            caption={data.credits ? `${data.credits.earned} / ${data.credits.target}` : '—'}
          />
          <Bar
            label="Subjects"
            value={subjectsPct}
            caption={`${data.academicChips?.length ?? 0} courses`}
          />
          <Bar
            label="Profile"
            value={data.profile.profileCompletion ?? 0}
            caption={`${data.profile.profileCompletion ?? 0}%`}
          />
        </div>
      </div>
    </div>
  );
}

function Bar({ label, value, caption }: { label: string; value: number; caption?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
        <span className="font-medium text-slate-600 dark:text-slate-300">{label}</span>
        <span className="text-slate-400">{caption || `${Math.round(v)}%`}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className="h-full rounded-full bg-[#1e4d8c] transition-all"
          style={{ width: `${v}%` }}
        />
      </div>
    </div>
  );
}
