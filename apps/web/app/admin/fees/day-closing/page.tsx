'use client';

import { FeeDayClosingPanel } from '@/components/fees-module/fee-day-closing-panel';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useRequireAuth } from '@/hooks/use-auth';

export default function Page() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" title="Day Closing Report">
      <FeeDayClosingPanel />
    </DashboardShell>
  );
}
