'use client';

import { FeeCycleConfigPanel } from '@/components/fees-module/fee-cycle-config-panel';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useRequireAuth } from '@/hooks/use-auth';

export default function AdminFeeCyclesPage() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" title="Fee Cycle Configuration">
      <FeeCycleConfigPanel />
    </DashboardShell>
  );
}
