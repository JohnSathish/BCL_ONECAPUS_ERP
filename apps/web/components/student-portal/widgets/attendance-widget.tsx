'use client';

import Link from 'next/link';
import { GlassCard } from '@/components/erp/glass-card';
import { attendanceTone, ProgressRing } from '@/components/portal/progress-ring';
import type { StudentDashboardView } from '@/types/student-portal';

export function AttendanceWidget({
  data,
  loading,
}: {
  data?: StudentDashboardView['attendance'];
  loading?: boolean;
}) {
  if (loading) {
    return (
      <GlassCard className="animate-pulse p-5">
        <div className="mx-auto h-24 w-24 rounded-full bg-muted" />
      </GlassCard>
    );
  }

  const pct = data?.overall ?? 0;
  const tone = attendanceTone(data?.overall);

  return (
    <GlassCard className="p-5">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold tracking-tight">Attendance</h3>
        <Link href="/student/attendance" className="text-xs text-primary hover:underline">
          View all
        </Link>
      </div>
      <div className="mt-4 flex flex-col items-center">
        <ProgressRing value={data?.overall ?? 0} tone={tone} label="Overall" size={108} />
      </div>
      {data?.subjects?.length ? (
        <ul className="mt-4 space-y-2">
          {data.subjects.slice(0, 4).map((s) => (
            <li key={s.id} className="flex items-center justify-between text-xs">
              <span className="truncate text-muted-foreground">{s.label}</span>
              <span className="font-semibold">{s.percentage.toFixed(0)}%</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-center text-xs text-muted-foreground">No subject data yet.</p>
      )}
    </GlassCard>
  );
}
