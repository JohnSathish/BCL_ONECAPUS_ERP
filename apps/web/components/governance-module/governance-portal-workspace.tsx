'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarDays,
  CheckSquare,
  ClipboardList,
  Loader2,
  Megaphone,
  Shield,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  fetchGovernancePortalAtr,
  fetchGovernancePortalMeetings,
  fetchGovernancePortalNotices,
  fetchGovernancePortalSummary,
  fetchGovernancePortalTasks,
} from '@/services/governance';
import { cn } from '@/utils/cn';

function Kpi({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: typeof Shield;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm">
      <Icon className="mb-2 h-5 w-5 text-primary" />
      <p className="text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function statusTone(status: string) {
  const s = status.toUpperCase();
  if (s.includes('COMPLET') || s === 'PUBLISHED' || s === 'PRESENT')
    return 'bg-emerald-100 text-emerald-800';
  if (s.includes('PEND') || s === 'SCHEDULED' || s === 'DRAFT')
    return 'bg-amber-100 text-amber-800';
  if (s.includes('OVERDUE') || s === 'ABSENT') return 'bg-rose-100 text-rose-800';
  return 'bg-muted text-muted-foreground';
}

export function GovernancePortalWorkspace() {
  const enabled = useAuthQueryEnabled();

  const summaryQ = useQuery({
    queryKey: ['governance', 'portal', 'summary'],
    queryFn: fetchGovernancePortalSummary,
    enabled,
  });
  const meetingsQ = useQuery({
    queryKey: ['governance', 'portal', 'meetings'],
    queryFn: () => fetchGovernancePortalMeetings({ limit: 10 }),
    enabled,
  });
  const atrQ = useQuery({
    queryKey: ['governance', 'portal', 'atr'],
    queryFn: () => fetchGovernancePortalAtr({ status: 'PENDING' }),
    enabled,
  });
  const tasksQ = useQuery({
    queryKey: ['governance', 'portal', 'tasks'],
    queryFn: () => fetchGovernancePortalTasks({ status: 'PENDING' }),
    enabled,
  });
  const noticesQ = useQuery({
    queryKey: ['governance', 'portal', 'notices'],
    queryFn: () => fetchGovernancePortalNotices({ limit: 10 }),
    enabled,
  });

  const summary = summaryQ.data;
  const kpis = summary?.kpis;
  const loading = summaryQ.isLoading;

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-primary/10 via-card to-accent/10 p-5 shadow-sm">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          <Shield className="h-3.5 w-3.5" />
          My Committees
        </div>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Committee member workspace</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          View assigned committees, upcoming meetings, pending ATR items, tasks, and notices.
        </p>
      </section>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading portal…
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Committees"
          value={kpis?.committeeCount ?? summary?.committees?.length ?? '—'}
          icon={Users}
        />
        <Kpi label="Upcoming meetings" value={kpis?.upcomingMeetings ?? '—'} icon={CalendarDays} />
        <Kpi label="Pending ATR" value={kpis?.pendingAtr ?? '—'} icon={ClipboardList} />
        <Kpi label="Pending tasks" value={kpis?.pendingTasks ?? '—'} icon={CheckSquare} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              My committees
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(summary?.committees ?? []).length ? (
              summary!.committees.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.shortCode} · {c.category}
                    </p>
                  </div>
                  <Badge className={cn('text-xs', statusTone(c.status))}>{c.status}</Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No committee assignments found.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4" />
              Upcoming meetings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(meetingsQ.data ?? summary?.upcomingMeetings ?? []).slice(0, 6).map((m) => (
              <div key={m.id} className="rounded-lg border px-3 py-2 text-sm">
                <p className="font-medium">{m.title}</p>
                <p className="text-xs text-muted-foreground">
                  {m.committeeName ?? 'Committee'} ·{' '}
                  {new Date(m.meetingDate).toLocaleString('en-IN')}
                  {m.venue ? ` · ${m.venue}` : ''}
                </p>
              </div>
            ))}
            {!meetingsQ.data?.length && !summary?.upcomingMeetings?.length ? (
              <p className="text-sm text-muted-foreground">No upcoming meetings.</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-4 w-4" />
              Pending ATR
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(atrQ.data ?? summary?.pendingAtr ?? []).slice(0, 6).map((a) => (
              <div key={a.id} className="rounded-lg border px-3 py-2 text-sm">
                <p className="font-medium">{a.actionItem}</p>
                <p className="text-xs text-muted-foreground">
                  {a.committeeName} · due{' '}
                  {a.targetDate ? new Date(a.targetDate).toLocaleDateString('en-IN') : '—'}
                </p>
              </div>
            ))}
            {!atrQ.data?.length && !summary?.pendingAtr?.length ? (
              <p className="text-sm text-muted-foreground">No pending action items.</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Megaphone className="h-4 w-4" />
              Recent notices
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(noticesQ.data ?? summary?.recentNotices ?? []).slice(0, 6).map((n) => (
              <div key={n.id} className="rounded-lg border px-3 py-2 text-sm">
                <p className="font-medium">{n.title}</p>
                <p className="text-xs text-muted-foreground">
                  {n.noticeNo ?? 'Notice'} ·{' '}
                  {n.publishedAt ? new Date(n.publishedAt).toLocaleDateString('en-IN') : n.status}
                </p>
              </div>
            ))}
            {!noticesQ.data?.length && !summary?.recentNotices?.length ? (
              <p className="text-sm text-muted-foreground">No notices yet.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {(tasksQ.data ?? summary?.pendingTasks ?? []).length ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Pending tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-2 py-2">Task</th>
                    <th className="px-2 py-2">Committee</th>
                    <th className="px-2 py-2">Due</th>
                    <th className="px-2 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(tasksQ.data ?? summary?.pendingTasks ?? []).map((t) => (
                    <tr key={t.id} className="border-b">
                      <td className="px-2 py-2 font-medium">{t.title}</td>
                      <td className="px-2 py-2">{t.committeeName ?? '—'}</td>
                      <td className="px-2 py-2">
                        {t.dueDate ? new Date(t.dueDate).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="px-2 py-2">
                        <Badge className={cn('text-xs', statusTone(t.status))}>{t.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Need admin access?{' '}
        <Link href="/admin/governance" className="text-primary underline-offset-4 hover:underline">
          Open governance console
        </Link>
      </p>
    </div>
  );
}
