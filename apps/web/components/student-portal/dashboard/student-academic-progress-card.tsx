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
      <div className="animate-pulse rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="h-5 w-36 rounded bg-muted" />
        <div className="mt-4 mx-auto h-28 w-28 rounded-full bg-muted" />
      </div>
    );
  }

  const creditsPct = data.credits?.percent ?? null;
  const ringPct =
    creditsPct != null && creditsPct > 0 ? creditsPct : (data.profile.profileCompletion ?? 0);
  const r = 46;
  const circ = 2 * Math.PI * r;
  const offset = circ - (ringPct / 100) * circ;

  return (
    <div className="rounded-3xl border border-slate-200/70 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Academic Progress</h3>
      </div>
      <div className="mt-3 flex flex-col items-center">
        <div className="relative h-[132px] w-[132px]">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
            <circle
              cx="60"
              cy="60"
              r={r}
              fill="none"
              stroke="currentColor"
              strokeWidth="10"
              className="text-slate-100 dark:text-slate-800"
            />
            <circle
              cx="60"
              cy="60"
              r={r}
              fill="none"
              stroke="url(#student-progress-grad)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={offset}
            />
            <defs>
              <linearGradient id="student-progress-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#0ea5e9" />
                <stop offset="100%" stopColor="#4f46e5" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
              {Math.round(ringPct)}%
            </span>
            <span className="text-[10px] font-medium text-slate-400">Complete</span>
          </div>
        </div>
        <Link
          href="/student/results"
          className="mt-3 text-xs font-semibold text-sky-700 hover:underline dark:text-sky-300"
        >
          View Academic Analytics →
        </Link>
      </div>
    </div>
  );
}
