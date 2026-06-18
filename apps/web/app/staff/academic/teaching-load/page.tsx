'use client';

import { useQuery } from '@tanstack/react-query';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { ErpWorkspace } from '@/components/erp/erp-workspace-shell';
import { GlassCard } from '@/components/erp/glass-card';
import { useRequireStaffPortal } from '@/hooks/use-require-staff-portal';
import { fetchFacultyWeekTimetable } from '@/services/timetable';

export default function StaffTeachingLoadPage() {
  useRequireStaffPortal();
  const timetableQ = useQuery({
    queryKey: ['staff', 'faculty-week-timetable'],
    queryFn: () => fetchFacultyWeekTimetable(),
  });

  const entries = timetableQ.data?.rows?.flatMap((row) => row.entries ?? []) ?? [];
  const byGroup = new Map<string, { title: string; code: string; count: number }>();

  for (const entry of entries) {
    const title = entry.teachingSubjectGroup?.title ?? entry.course?.title ?? 'Teaching slot';
    const code = entry.teachingSubjectGroup?.code ?? entry.course?.code ?? '—';
    const key = `${code}:${title}`;
    const existing = byGroup.get(key);
    byGroup.set(key, {
      title,
      code,
      count: (existing?.count ?? 0) + 1,
    });
  }

  const groups = [...byGroup.values()].sort((a, b) => a.title.localeCompare(b.title));
  const weeklyPeriods = entries.length;

  return (
    <DashboardShell role="staff" title="Teaching Load">
      <ErpWorkspace>
        <GlassCard className="p-6">
          <h2 className="text-lg font-semibold tracking-tight">Teaching Load</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Weekly periods and subject groups from your published timetable (
            {timetableQ.data?.plan?.name ?? 'loading…'}).
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Weekly periods
              </p>
              <p className="mt-1 text-2xl font-semibold">{weeklyPeriods}</p>
            </div>
            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Subject groups
              </p>
              <p className="mt-1 text-2xl font-semibold">{groups.length}</p>
            </div>
            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Plan status</p>
              <p className="mt-1 text-sm font-semibold">{timetableQ.data?.plan?.status ?? '—'}</p>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Subject group</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Periods / week</th>
                </tr>
              </thead>
              <tbody>
                {groups.length ? (
                  groups.map((group) => (
                    <tr key={`${group.code}-${group.title}`} className="border-t">
                      <td className="px-4 py-3 font-medium">{group.title}</td>
                      <td className="px-4 py-3 text-muted-foreground">{group.code}</td>
                      <td className="px-4 py-3">{group.count}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                      {timetableQ.isLoading
                        ? 'Loading timetable…'
                        : 'No teaching assignments on the published plan yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </ErpWorkspace>
    </DashboardShell>
  );
}
