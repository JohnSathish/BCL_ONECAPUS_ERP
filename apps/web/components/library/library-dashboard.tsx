'use client';

import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  BookOpen,
  IndianRupee,
  LogIn,
  LogOut,
  Monitor,
  RefreshCw,
  Users,
} from 'lucide-react';

import { CircularProgress } from '@/components/dashboard/command-center-ui';
import { Button } from '@/components/ui/button';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useLibraryRealtime } from '@/hooks/use-library-realtime';
import { fetchLibraryDashboard, fetchLibraryDashboardActivity } from '@/services/library';
import type { LibraryActivityItem } from '@/types/library';
import { LibraryKnowledgeAssistant } from '@/components/library/library-knowledge-assistant';

function Kpi({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: typeof BookOpen;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-primary/70" />
      </div>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString();
}

function actionLabel(action: string) {
  if (action === 'ISSUE') return 'Borrowed';
  if (action === 'RETURN') return 'Returned';
  if (action === 'RENEW') return 'Renewed';
  return action;
}

function HealthMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.min(100, value)}%` }}
          />
        </div>
        <span className="text-xs font-medium tabular-nums">{value}</span>
      </div>
    </div>
  );
}

export function LibraryDashboard() {
  const enabled = useAuthQueryEnabled();
  const [liveActivity, setLiveActivity] = useState<LibraryActivityItem[]>([]);

  const dashboard = useQuery({
    queryKey: ['library', 'dashboard'],
    queryFn: fetchLibraryDashboard,
    enabled,
    refetchInterval: 30_000,
  });

  const activityPoll = useQuery({
    queryKey: ['library', 'dashboard', 'activity'],
    queryFn: () => fetchLibraryDashboardActivity(20),
    enabled,
    refetchInterval: 5_000,
  });

  useEffect(() => {
    if (dashboard.data?.activity?.length) {
      setLiveActivity(dashboard.data.activity);
    }
  }, [dashboard.data?.activity]);

  useEffect(() => {
    if (activityPoll.data?.length) {
      setLiveActivity(activityPoll.data);
    }
  }, [activityPoll.data]);

  const onCirculationActivity = useCallback((item: LibraryActivityItem) => {
    setLiveActivity((prev) => {
      const next = [item, ...prev.filter((p) => p.at !== item.at)];
      return next.slice(0, 20);
    });
  }, []);

  useLibraryRealtime({ onCirculationActivity });

  const d = dashboard.data;
  const health = d?.healthScore;
  const entry = d?.entryAnalytics;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6" />
          <div>
            <h1 className="text-xl font-semibold">Smart Library Dashboard</h1>
            <p className="text-sm text-muted-foreground">NAAC-ready knowledge center overview</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={dashboard.isFetching}
          onClick={() => void dashboard.refetch()}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${dashboard.isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Total Books (copies)" value={d?.totalBooks ?? '—'} icon={BookOpen} />
        <Kpi label="Total Titles" value={d?.totalTitles ?? '—'} icon={BookOpen} />
        <Kpi label="Issued Today" value={d?.issuedToday ?? '—'} icon={LogOut} />
        <Kpi label="Returned Today" value={d?.returnedToday ?? '—'} icon={LogIn} />
        <Kpi label="Overdue" value={d?.overdueLoans ?? '—'} icon={Activity} />
        <Kpi
          label="Fine Collection Today"
          value={d ? `₹${(d.fineCollectedToday ?? 0).toFixed(0)}` : '—'}
          icon={IndianRupee}
        />
        <Kpi
          label="Visitors Today"
          value={d?.todayVisitors ?? '—'}
          hint={entry?.active ? `CAMS: ${entry.total} entries` : 'Library visits'}
          icon={Users}
        />
        <Kpi label="Digital Resource Views" value={d?.digitalViewsToday ?? '—'} icon={Monitor} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-5 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-medium">Live Library Activity</h2>
            <span className="text-xs text-muted-foreground">Realtime + 5s poll</span>
          </div>
          {liveActivity.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No circulation activity yet today.
            </p>
          ) : (
            <ul className="max-h-80 space-y-2 overflow-y-auto">
              {liveActivity.map((item, i) => (
                <li
                  key={`${item.at}-${i}`}
                  className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{item.memberName}</p>
                    <p className="text-muted-foreground">
                      {actionLabel(item.action)} — {item.bookTitle}
                    </p>
                    {item.programme ? (
                      <p className="text-xs text-muted-foreground">{item.programme}</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(item.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="mb-4 font-medium">Knowledge Center Health</h2>
          {health ? (
            <div className="space-y-4">
              <CircularProgress
                value={health.overall}
                label={`${health.overall}`}
                sublabel="Overall score"
                color={
                  health.overall >= 70 ? '#16A34A' : health.overall >= 40 ? '#F59E0B' : '#EF4444'
                }
              />
              <HealthMetric label="Library usage" value={health.usage} />
              <HealthMetric label="Circulation activity" value={health.circulation} />
              <HealthMetric label="Digital engagement" value={health.digital} />
              <HealthMetric label="Overdue control" value={health.overdueControl} />
              <HealthMetric label="Weekly engagement" value={health.engagement} />
              <p className="text-xs text-muted-foreground">
                Entry analytics: {health.entryAnalytics ? 'CAMS active' : 'Not linked'}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Loading health score…</p>
          )}
        </div>
      </div>

      {entry ? (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-medium">Today&apos;s entry analytics (CAMS)</h2>
          {entry.active ? (
            <div className="grid gap-3 sm:grid-cols-5">
              <div className="rounded-lg border px-3 py-2 text-center">
                <p className="text-xs text-muted-foreground">Male</p>
                <p className="text-lg font-semibold">{entry.male}</p>
              </div>
              <div className="rounded-lg border px-3 py-2 text-center">
                <p className="text-xs text-muted-foreground">Female</p>
                <p className="text-lg font-semibold">{entry.female}</p>
              </div>
              <div className="rounded-lg border px-3 py-2 text-center">
                <p className="text-xs text-muted-foreground">Staff / Faculty</p>
                <p className="text-lg font-semibold">{entry.staff}</p>
              </div>
              <div className="rounded-lg border px-3 py-2 text-center">
                <p className="text-xs text-muted-foreground">Guests</p>
                <p className="text-lg font-semibold">{entry.guests}</p>
              </div>
              <div className="rounded-lg border bg-primary/5 px-3 py-2 text-center">
                <p className="text-xs text-muted-foreground">Total IN</p>
                <p className="text-lg font-semibold">{entry.total}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No CAMS library access point configured. Footfall uses library visit records.
            </p>
          )}
        </div>
      ) : null}

      <LibraryKnowledgeAssistant />

      {d?.occupancy ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Kpi
            label="Current occupancy"
            value={`${d.occupancy.totalInside} / ${d.occupancy.totalSeats}`}
            hint={`${d.occupancy.occupancyPercent}% capacity`}
            icon={Users}
          />
          <Kpi label="Active loans" value={d.activeLoans} icon={BookOpen} />
          <Kpi label="Available copies" value={d.availableCopies} icon={BookOpen} />
        </div>
      ) : null}
    </div>
  );
}
