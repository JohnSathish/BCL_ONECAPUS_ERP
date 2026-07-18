'use client';

import { FeeSettlementReconciliationPanel } from '@/components/fees-module/fee-settlement-reconciliation-panel';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useRequireAuth } from '@/hooks/use-auth';

export default function FeeReconciliationPage() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" title="Finance / Fee Reconciliation">
      <FeeSettlementReconciliationPanel />
    </DashboardShell>
  );
}
