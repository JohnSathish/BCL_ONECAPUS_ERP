'use client';

import type { CycleDashboard } from '@/types/academic-lifecycle';
import { CompactCard, CompactCardHeader, CompactCardBody } from '@/components/erp/compact-card';
import { cn } from '@/utils/cn';

type Props = {
  dashboard: CycleDashboard | undefined;
  loading?: boolean;
};

function KpiCard({ title, value }: { title: string; value: string }) {
  return (
    <CompactCard>
      <CompactCardHeader title={title} />
      <CompactCardBody>
        <p className="text-2xl font-semibold">{value}</p>
      </CompactCardBody>
    </CompactCard>
  );
}

function ActiveAcademicYearCard({
  sessionName,
  sessionStatus,
}: {
  sessionName: string;
  sessionStatus?: string;
}) {
  const isActive = sessionStatus === 'ACTIVE';
  const statusLabel = sessionStatus ?? 'Unknown';

  return (
    <CompactCard className="border-primary/20 bg-primary/[0.02]">
      <CompactCardHeader title="Active Academic Year" />
      <CompactCardBody className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-2xl font-semibold tracking-tight">{sessionName}</p>
          {isActive ? (
            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
              Active
            </span>
          ) : null}
        </div>
        <p
          className={cn(
            'text-xs',
            isActive ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground',
          )}
        >
          Session status: {statusLabel}
        </p>
      </CompactCardBody>
    </CompactCard>
  );
}

export function LifecycleDashboardCards({ dashboard, loading }: Props) {
  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard title="Active Academic Year" value="—" />
        {Array.from({ length: 4 }).map((_, i) => (
          <KpiCard key={i} title="Loading…" value="—" />
        ))}
      </div>
    );
  }

  const activeLabel = dashboard?.activeSemesters?.length
    ? dashboard.activeSemesters.map((s) => `Sem ${s}`).join(', ')
    : 'None';

  const sessionName = dashboard?.primarySession?.name ?? 'Not set';

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <ActiveAcademicYearCard
        sessionName={sessionName}
        sessionStatus={dashboard?.primarySession?.status}
      />
      <KpiCard title="Current cycle" value={dashboard?.currentCycle ?? '—'} />
      <KpiCard title="Active semesters" value={activeLabel} />
      <KpiCard title="Total students" value={String(dashboard?.totalStudents ?? 0)} />
      <KpiCard
        title="Promotion status"
        value={`${dashboard?.promotionStatus.pendingBatches ?? 0} preview · ${dashboard?.promotionStatus.recentRuns ?? 0} runs`}
      />
    </div>
  );
}
