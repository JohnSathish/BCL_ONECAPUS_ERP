'use client';

import { useQuery } from '@tanstack/react-query';

import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  fetchLibraryDashboard,
  fetchLibraryDepartmentHeatmap,
  fetchLibraryGenderTrends,
  fetchLibraryFootfall,
} from '@/services/library';

function HeatBar({ intensity, label, value }: { intensity: number; label: string; value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted-foreground">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${Math.max(8, intensity)}%` }}
        />
      </div>
    </div>
  );
}

export function LibraryAnalyticsWorkspace() {
  const enabled = useAuthQueryEnabled();
  const dashboard = useQuery({
    queryKey: ['library', 'dashboard'],
    queryFn: fetchLibraryDashboard,
    enabled,
  });
  const footfall = useQuery({
    queryKey: ['library', 'footfall'],
    queryFn: fetchLibraryFootfall,
    enabled,
  });
  const heatmap = useQuery({
    queryKey: ['library', 'heatmap'],
    queryFn: fetchLibraryDepartmentHeatmap,
    enabled,
  });
  const gender = useQuery({
    queryKey: ['library', 'gender-trends'],
    queryFn: fetchLibraryGenderTrends,
    enabled,
  });

  const d = dashboard.data;
  const f = footfall.data ?? d?.footfallTrends;
  const h = heatmap.data ?? d?.departmentHeatmap;
  const g = gender.data ?? d?.genderTrends;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Library Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Footfall, department usage, and circulation intelligence
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Week footfall</p>
          <p className="mt-1 text-2xl font-semibold">{d?.weekVisitors ?? '—'}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Overdue loans</p>
          <p className="mt-1 text-2xl font-semibold text-amber-700">{d?.overdueLoans ?? '—'}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Unpaid fines</p>
          <p className="mt-1 text-2xl font-semibold">{d?.unpaidFinesCount ?? '—'}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Fine outstanding</p>
          <p className="mt-1 text-2xl font-semibold">₹{d?.unpaidFinesTotal?.toFixed(0) ?? '—'}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {f ? (
          <div className="rounded-lg border p-4">
            <h2 className="mb-3 text-sm font-medium">Weekly footfall (last 7 days)</h2>
            <ul className="space-y-2">
              {f.weekly.map((row) => (
                <li key={row.date} className="flex items-center gap-3 text-sm">
                  <span className="w-24 shrink-0 text-muted-foreground">{row.date}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary/80"
                      style={{
                        width: `${Math.max(4, (row.count / Math.max(...f.weekly.map((w) => w.count), 1)) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="w-8 text-right">{row.count}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {h ? (
          <div className="rounded-lg border p-4">
            <h2 className="mb-3 text-sm font-medium">Department heatmap (30 days)</h2>
            <div className="space-y-3">
              {h.rows.slice(0, 12).map((row) => (
                <HeatBar
                  key={row.departmentName}
                  label={row.departmentName}
                  value={row.visits}
                  intensity={row.intensity}
                />
              ))}
              {!h.rows.length ? (
                <p className="text-sm text-muted-foreground">No student visits yet</p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {g ? (
        <div className="rounded-lg border p-4">
          <h2 className="mb-3 text-sm font-medium">Gender trends (weekly, 30 days)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-2 text-left">Week</th>
                  <th className="p-2 text-left">Male</th>
                  <th className="p-2 text-left">Female</th>
                  <th className="p-2 text-left">Total</th>
                </tr>
              </thead>
              <tbody>
                {g.weekly.map((row) => (
                  <tr key={row.week} className="border-t">
                    <td className="p-2">Week {row.week}</td>
                    <td className="p-2">{row.male}</td>
                    <td className="p-2">{row.female}</td>
                    <td className="p-2">{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
