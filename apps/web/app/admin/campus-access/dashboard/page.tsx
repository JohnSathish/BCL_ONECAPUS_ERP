'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { AdminPageHeader } from '@/components/administration-module/admin-page-header';
import { AdminShell } from '@/components/administration-module/ui/admin-shell';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { useRequireAuth } from '@/hooks/use-auth';
import { fetchCamsDashboard } from '@/services/campus-access';

export default function CamsDashboardPage() {
  useRequireAuth();
  const dashQ = useQuery({
    queryKey: ['cams', 'dashboard'],
    queryFn: fetchCamsDashboard,
    refetchInterval: 5000,
  });
  const d = dashQ.data;

  return (
    <DashboardShell role="admin" title="Access Dashboard">
      <AdminShell>
        <AdminPageHeader
          title="Campus Access — Live Dashboard"
          subtitle="Footfall, occupancy, and scan activity across all access points"
          actions={
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/campus-access">Configure access points</Link>
            </Button>
          }
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Today's entries" value={d?.todayEntries ?? '—'} />
          <Kpi label="Today's exits" value={d?.todayExits ?? '—'} />
          <Kpi label="Currently inside" value={d?.currentlyInside ?? '—'} />
          <Kpi label="Scans today" value={d?.scansToday ?? '—'} />
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <Panel title="Students inside">
            <Line label="Male" value={d?.studentsInside.male} />
            <Line label="Female" value={d?.studentsInside.female} />
            <Line label="Total" value={d?.studentsInside.total} />
          </Panel>
          <Panel title="Staff inside">
            <Line label="Teaching" value={d?.staffInside.teaching} />
            <Line label="Non-teaching" value={d?.staffInside.nonTeaching} />
          </Panel>
          <Panel title="Visitors">
            <Line label="Inside now" value={d?.visitorsInside} />
            <Line label="Peak hour" value={d?.peakHour ?? '—'} />
          </Panel>
        </div>
      </AdminShell>
    </DashboardShell>
  );
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <h3 className="font-semibold">{title}</h3>
      <dl className="mt-3 space-y-2">{children}</dl>
    </div>
  );
}

function Line({ label, value }: { label: string; value?: number | string | null }) {
  return (
    <div className="flex justify-between text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold">{value ?? '—'}</dd>
    </div>
  );
}
