'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, BookOpen, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  fetchLibraryDashboard,
  fetchLibraryDepartmentHeatmap,
  fetchLibraryFootfall,
  fetchLibraryGenderTrends,
  fetchLibraryReadingAnalytics,
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
  const [days, setDays] = useState(365);

  const dashboard = useQuery({
    queryKey: ['library', 'dashboard'],
    queryFn: fetchLibraryDashboard,
    enabled,
  });
  const reading = useQuery({
    queryKey: ['library', 'reading-analytics', days],
    queryFn: () => fetchLibraryReadingAnalytics(days),
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
  const r = reading.data;
  const f = footfall.data ?? d?.footfallTrends;
  const h = heatmap.data ?? d?.departmentHeatmap;
  const g = gender.data ?? d?.genderTrends;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Reading Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Top books, active readers, and department circulation usage
          </p>
        </div>
        <div className="flex gap-2">
          {[90, 180, 365].map((d) => (
            <Button
              key={d}
              size="sm"
              variant={days === d ? 'default' : 'outline'}
              onClick={() => setDays(d)}
            >
              {d}d
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-4 lg:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            <h2 className="font-medium">Top 20 books</h2>
          </div>
          {r?.topBooks.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-2 text-left">#</th>
                    <th className="p-2 text-left">Title</th>
                    <th className="p-2 text-left">Accession</th>
                    <th className="p-2 text-right">Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {r.topBooks.map((book, i) => (
                    <tr key={book.bookId} className="border-t">
                      <td className="p-2 text-muted-foreground">{i + 1}</td>
                      <td className="p-2">
                        <p className="font-medium">{book.title}</p>
                        <p className="text-xs text-muted-foreground">{book.author ?? '—'}</p>
                      </td>
                      <td className="p-2 font-mono text-xs">{book.accessionNo}</td>
                      <td className="p-2 text-right font-semibold">{book.issueCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No circulation data yet
            </p>
          )}
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <h2 className="font-medium">Summary</h2>
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Period from</dt>
              <dd>{r?.from ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Overdue loans</dt>
              <dd>{d?.overdueLoans ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Week footfall</dt>
              <dd>{d?.weekVisitors ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Departments active</dt>
              <dd>{r?.departmentUsage.length ?? 0}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Users className="h-4 w-4" />
            <h2 className="font-medium">Top 50 readers</h2>
          </div>
          {r?.topReaders.length ? (
            <ul className="max-h-96 space-y-2 overflow-y-auto">
              {r.topReaders.map((reader, i) => (
                <li
                  key={`${reader.memberType}:${reader.memberId}`}
                  className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {i + 1}. {reader.fullName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {reader.registrationNumber ?? reader.memberType} · {reader.department ?? '—'}
                    </p>
                  </div>
                  <span className="font-semibold tabular-nums">{reader.issueCount}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">No readers yet</p>
          )}
        </div>

        <div className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 font-medium">Department usage (circulation)</h2>
          {r?.departmentUsage.length ? (
            <div className="space-y-3">
              {r.departmentUsage.slice(0, 15).map((row) => (
                <HeatBar
                  key={row.departmentName}
                  label={`${row.departmentName} (${row.uniqueReaders} readers)`}
                  value={row.issueCount}
                  intensity={row.intensity}
                />
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">No department data yet</p>
          )}
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
            <h2 className="mb-3 text-sm font-medium">Visit heatmap by department (30 days)</h2>
            <div className="space-y-3">
              {h.rows.slice(0, 10).map((row) => (
                <HeatBar
                  key={row.departmentName}
                  label={row.departmentName}
                  value={row.visits}
                  intensity={row.intensity}
                />
              ))}
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
